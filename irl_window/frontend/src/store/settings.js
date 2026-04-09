import { create } from 'zustand';

const useSettingsStore = create((set, get) => ({
  settingsOpen:    false,
  activeTab:       'user',  // 'user' | 'projects' | 'about'
  panelsDraggable: false,

  // User config (mirrored from backend)
  username:    '',
  userCreated: null,

  openSettings:  (tab = 'user') => set({ settingsOpen: true, activeTab: tab }),
  closeSettings: () => set({ settingsOpen: false }),
  toggleSettings:() => set(s => ({ settingsOpen: !s.settingsOpen })),

  setActiveTab: tab => set({ activeTab: tab }),

  setSetting: (key, value) => set({ [key]: value }),

  applyUserConfig: (cfg) => set({
    username:    cfg?.user?.username ?? '',
    userCreated: cfg?.user?.created_at ?? null,
  }),
}));

export default useSettingsStore;
