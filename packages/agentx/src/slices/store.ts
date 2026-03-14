import { configureStore } from "@reduxjs/toolkit";
import chatReducer from "./chatSlice";
import settingsReducer from "./settingsSlice";
import uiReducer from "./uiSlice";
import updateReducer from "./updateSlice";

export const store = configureStore({
  reducer: {
    chat: chatReducer,
    settings: settingsReducer,
    ui: uiReducer,
    update: updateReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
