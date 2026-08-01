'use server';

import { backendFetch } from '@/lib/backendFetch';
import { FollowRequest } from '@/types/followunfollowTypes';

export const follow = async (data: FollowRequest) => {
  try {
    const res = await backendFetch('/v2/follow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      console.log(res.statusText);
      return null;
    }

    return res.json();
  } catch (error) {
    console.error(error);
    return null;
  }
};

export const unfollow = async (data: FollowRequest) => {
  try {
    const res = await backendFetch('/v2/unfollow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      console.log(res.statusText);
      return null;
    }

    return res.json();
  } catch (error) {
    console.error(error);
    return null;
  }
};
