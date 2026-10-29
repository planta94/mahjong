import { Routes } from '@angular/router';
import { LobbyComponent } from './pages/lobby/lobby.component';
import { TableComponent } from './pages/table/table.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: LobbyComponent },
  { path: 'lobby', component: LobbyComponent },
  { path: 'table', component: TableComponent },
  { path: '**', redirectTo: '' },
];
