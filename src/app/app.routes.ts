import { Routes } from '@angular/router';
import { HubComponent } from './pages/hub/hub.component';
import { LobbyComponent } from './pages/lobby/lobby.component';
import { TableComponent } from './pages/table/table.component';

import { MonopolyLobbyComponent } from './games/monopoly/components/monopoly-lobby/monopoly-lobby.component';
import { MonopolyBoardComponent } from './games/monopoly/components/monopoly-board/monopoly-board.component';
import { AvalonLobbyComponent } from './games/avalon/components/avalon-lobby/avalon-lobby.component';
import { PandemicLobbyComponent } from './games/pandemic/components/pandemic-lobby/pandemic-lobby.component';
import { BalikKampungLobbyComponent } from './games/balik-kampung/components/balik-kampung-lobby/balik-kampung-lobby.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: HubComponent },
  { path: 'lobby', redirectTo: 'mahjong/lobby' },
  { path: 'table', redirectTo: 'mahjong/table' },
  {
    path: 'mahjong',
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'lobby' },
      { path: 'lobby', component: LobbyComponent },
      { path: 'table', component: TableComponent },
    ],
  },
  {
    path: 'monopoly',
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'lobby' },
      { path: 'lobby', component: MonopolyLobbyComponent },
      { path: 'board', component: MonopolyBoardComponent },
    ],
  },
  {
    path: 'avalon',
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'lobby' },
      { path: 'lobby', component: AvalonLobbyComponent },
      {
        path: 'table',
        loadComponent: () =>
          import('./games/avalon/components/avalon-table/avalon-table.component').then(
            (m) => m.AvalonTableComponent
          ),
      },
    ],
  },
  {
    path: 'pandemic',
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'lobby' },
      { path: 'lobby', component: PandemicLobbyComponent },
      {
        path: 'board',
        loadComponent: () =>
          import('./games/pandemic/components/pandemic-board/pandemic-board.component').then(
            (m) => m.PandemicBoardComponent
          ),
      },
    ],
  },
  {
    path: 'balik-kampung',
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'lobby' },
      { path: 'lobby', component: BalikKampungLobbyComponent },
      {
        path: 'board',
        loadComponent: () =>
          import(
            './games/balik-kampung/components/balik-kampung-board/balik-kampung-board.component'
          ).then((m) => m.BalikKampungBoardComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
