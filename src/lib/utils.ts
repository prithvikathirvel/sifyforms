import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const RemoveItemsFromLocalStorage = (isRefreshTokenRemoved: boolean = true) => {
  localStorage.removeItem('token');
  if (isRefreshTokenRemoved) {
    localStorage.removeItem('refreshToken');
  }
  localStorage.removeItem('currentOrgId');
};