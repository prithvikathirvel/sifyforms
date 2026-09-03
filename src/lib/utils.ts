import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Clear everything tied to a session.
 *
 * Tokens are no longer kept here - the access token lives in memory and the
 * refresh token in an httpOnly cookie - so the leftover keys are removed to
 * clean up sessions started before that change.
 */
export const RemoveItemsFromLocalStorage = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('currentOrgId');
};