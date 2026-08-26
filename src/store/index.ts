import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import orgReducer from './orgSlice';
import formsReducer from './formsSlice';
import builderReducer from './builderSlice';
import submissionsReducer from './submissionsSlice';
import membersReducer from './membersSlice';
import teamsReducer from './teamsSlice';
import formSharingReducer from './formSharingSlice';
import rolesReducer from './rolesSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    org: orgReducer,
    forms: formsReducer,
    builder: builderReducer,
    submissions: submissionsReducer,
    members: membersReducer,
    teams: teamsReducer,
    formSharing: formSharingReducer,
    roles: rolesReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
