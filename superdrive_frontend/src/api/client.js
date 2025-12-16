/**
 * API client disabled in Offline Mode.
 * This module is intentionally a stub to catch any accidental network usage.
 */

// PUBLIC_INTERFACE
export const AuthAPI = {
  /** Disabled - use OfflineAuthAdapter instead. */
  async login() {
    throw new Error("AuthAPI.login is disabled in Offline Mode");
  },
  async logout() {
    throw new Error("AuthAPI.logout is disabled in Offline Mode");
  },
  async me() {
    throw new Error("AuthAPI.me is disabled in Offline Mode");
  },
};

// PUBLIC_INTERFACE
export const FilesAPI = {
  /** Disabled - use OfflineFilesAdapter instead. */
  async list() {
    throw new Error("FilesAPI.list is disabled in Offline Mode");
  },
  async createDir() {
    throw new Error("FilesAPI.createDir is disabled in Offline Mode");
  },
  async rename() {
    throw new Error("FilesAPI.rename is disabled in Offline Mode");
  },
  async move() {
    throw new Error("FilesAPI.move is disabled in Offline Mode");
  },
  async remove() {
    throw new Error("FilesAPI.remove is disabled in Offline Mode");
  },
  async upload() {
    throw new Error("FilesAPI.upload is disabled in Offline Mode");
  },
  async download() {
    throw new Error("FilesAPI.download is disabled in Offline Mode");
  },
};

// PUBLIC_INTERFACE
export function isGuestLoginEnabled() {
  /** Guest login is always enabled in Offline Mode. */
  return true;
}
