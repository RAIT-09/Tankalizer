# Usage:
#   pip install mysql-connector-python
#   RDB_HOST=... RDB_USER=... RDB_PASSWORD=... RDB_NAME=... python3 migrateDB/export_to_d1.py
#   for f in migrateDB/d1_export/[0-9][0-9]_*.sql; do npx wrangler d1 execute tankalizer --remote --config backend/wrangler.jsonc --file="$f"; done
#   npx wrangler d1 execute tankalizer --remote --config backend/wrangler.jsonc --file=migrateDB/d1_export/verify.sql

import math
import os
import re
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from typing import Any, Iterable, Sequence


ROWS_PER_FILE = 500
OUTPUT_DIR = Path(__file__).resolve().parent / "d1_export"


@dataclass(frozen=True)
class TableExport:
    number: int
    name: str
    columns: tuple[str, ...]
    select_sql: str


TABLES = (
    TableExport(
        1,
        "users",
        (
            "id",
            "name",
            "oauth_app",
            "connect_info",
            "profile_text",
            "icon_url",
            "created_at",
            "old_icon_url",
        ),
        """SELECT id, name, oauth_app, connect_info, profile_text, icon_url,
                  DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at,
                  old_icon_url
           FROM users
           ORDER BY id""",
    ),
    TableExport(
        2,
        "posts",
        (
            "id",
            "original",
            "tanka",
            "image_path",
            "created_at",
            "user_id",
            "is_deleted",
        ),
        """SELECT id, original, CAST(tanka AS CHAR) AS tanka, image_path,
                  DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at,
                  user_id, is_deleted
           FROM posts
           ORDER BY id""",
    ),
    TableExport(
        3,
        "developers",
        ("user_id", "developer_since"),
        """SELECT user_id,
                  DATE_FORMAT(developer_since, '%Y-%m-%dT%H:%i:%sZ') AS developer_since
           FROM developers
           ORDER BY user_id""",
    ),
    TableExport(
        4,
        "follows",
        ("follower_id", "followee_id", "followed_at"),
        """SELECT follower_id, followee_id,
                  DATE_FORMAT(followed_at, '%Y-%m-%dT%H:%i:%sZ') AS followed_at
           FROM follows
           ORDER BY follower_id, followee_id""",
    ),
    TableExport(
        5,
        "miyabis",
        ("id", "user_id", "post_id", "created_at"),
        """SELECT id, user_id, post_id,
                  DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at
           FROM miyabis
           ORDER BY id""",
    ),
)


def sqlite_literal(value: Any) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError("SQLiteリテラルに非有限の浮動小数点数は使用できません")
        return repr(value)
    if isinstance(value, bytes):
        value = value.decode("utf-8")
    escaped = str(value).replace("'", "''")
    return f"'{escaped}'"


def insert_statement(table: TableExport, row: Sequence[Any]) -> str:
    if len(row) != len(table.columns):
        raise ValueError(
            f"{table.name}: 取得列数が不正です "
            f"(expected={len(table.columns)}, actual={len(row)})"
        )
    columns = ", ".join(table.columns)
    values = ", ".join(sqlite_literal(value) for value in row)
    return f"INSERT INTO {table.name} ({columns}) VALUES ({values});"


def chunked(rows: Iterable[Sequence[Any]], size: int) -> Iterable[list[Sequence[Any]]]:
    chunk: list[Sequence[Any]] = []
    for row in rows:
        chunk.append(row)
        if len(chunk) == size:
            yield chunk
            chunk = []
    if chunk:
        yield chunk


def output_filename(table: TableExport, chunk_number: int) -> str:
    base = f"{table.number:02d}_{table.name}"
    suffix = "" if chunk_number == 1 else f"_{chunk_number:03d}"
    return f"{base}{suffix}.sql"


def write_table_files(
    output_dir: Path, table: TableExport, rows: Iterable[Sequence[Any]]
) -> int:
    row_count = 0
    wrote_file = False
    for chunk_number, row_chunk in enumerate(chunked(rows, ROWS_PER_FILE), start=1):
        path = output_dir / output_filename(table, chunk_number)
        statements = [insert_statement(table, row) for row in row_chunk]
        path.write_text("\n".join(statements) + "\n", encoding="utf-8")
        row_count += len(row_chunk)
        wrote_file = True
    if not wrote_file:
        (output_dir / output_filename(table, 1)).write_text(
            f"-- {table.name}: 0 rows\n", encoding="utf-8"
        )
    return row_count


def verify_sql(tables: Sequence[TableExport]) -> str:
    statements = [f"SELECT COUNT(*) FROM {table.name};" for table in tables]
    statements.append("SELECT COUNT(*) FROM posts WHERE json_valid(tanka) = 0;")
    return "\n".join(statements) + "\n"


def connection_settings(environ: dict[str, str]) -> dict[str, Any]:
    required = ("RDB_HOST", "RDB_USER", "RDB_PASSWORD", "RDB_NAME")
    missing = [name for name in required if name not in environ]
    if missing:
        raise RuntimeError(f"環境変数が不足しています: {', '.join(missing)}")
    return {
        "host": environ["RDB_HOST"],
        "user": environ["RDB_USER"],
        "password": environ["RDB_PASSWORD"],
        "database": environ["RDB_NAME"],
        "charset": "utf8mb4",
        "use_unicode": True,
    }


def connect_mysql(settings: dict[str, Any]) -> Any:
    try:
        import mysql.connector
    except ModuleNotFoundError as error:
        raise RuntimeError(
            "mysql-connector-python が必要です: pip install mysql-connector-python"
        ) from error
    return mysql.connector.connect(**settings)


def clean_generated_files(output_dir: Path) -> None:
    generated_name = re.compile(r"0[1-5]_[a-z]+(?:_\d{3})?\.sql")
    for path in output_dir.glob("*.sql"):
        if path.name == "verify.sql" or generated_name.fullmatch(path.name):
            path.unlink()


def export_database(connection: Any, output_dir: Path) -> dict[str, int]:
    output_dir.mkdir(parents=True, exist_ok=True)
    clean_generated_files(output_dir)
    counts: dict[str, int] = {}
    cursor = connection.cursor()
    try:
        cursor.execute("SET time_zone = '+00:00'")
        for table in TABLES:
            cursor.execute(table.select_sql)
            rows = iter(lambda: cursor.fetchmany(ROWS_PER_FILE), [])
            counts[table.name] = write_table_files(
                output_dir,
                table,
                (row for batch in rows for row in batch),
            )
    finally:
        cursor.close()
    (output_dir / "verify.sql").write_text(verify_sql(TABLES), encoding="utf-8")
    return counts


def main() -> None:
    settings = connection_settings(dict(os.environ))
    connection = connect_mysql(settings)
    try:
        counts = export_database(connection, OUTPUT_DIR)
    finally:
        connection.close()

    print(f"Exported SQL files to: {OUTPUT_DIR}")
    for table in TABLES:
        print(f"{table.name}: {counts[table.name]} rows")


if __name__ == "__main__":
    main()
