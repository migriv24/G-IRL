import { create } from 'zustand';

const useSettingsStore = create((set, get) => ({
  settingsOpen:    false,
  panelsDraggable: false,   // Off by default — enable in Settings

  openSettings:  () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  toggleSettings:() => set(s => ({ settingsOpen: !s.settingsOpen })),

  setSetting: (key, value) => set({ [key]: value }),
}));

export default useSettingsStore;
