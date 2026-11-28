const nameKey = 'meshimatch_device_display_name_v1';
const changeEvent = 'meshimatch-device-profile-updated';
export const maxDeviceNameLength = 40;

export function readDeviceName(): string {
  try {
    const value = localStorage.getItem(nameKey)?.trim() ?? '';
    return value.length <= maxDeviceNameLength ? value : '';
  } catch {
    return '';
  }
}

export function saveDeviceName(value: string) {
  const name = value.trim();
  if (name.length > maxDeviceNameLength) throw new Error('表示名は40文字以内で入力してください。');
  if (name) localStorage.setItem(nameKey, name);
  else localStorage.removeItem(nameKey);
  window.dispatchEvent(new Event(changeEvent));
}

export function subscribeDeviceName(listener: () => void) {
  const storageChanged = (event: StorageEvent) => {
    if (event.key === nameKey || event.key === null) listener();
  };
  window.addEventListener('storage', storageChanged);
  window.addEventListener(changeEvent, listener);
  return () => {
    window.removeEventListener('storage', storageChanged);
    window.removeEventListener(changeEvent, listener);
  };
}
