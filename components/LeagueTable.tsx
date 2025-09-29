import React from 'react';
import { LeagueTableRow, Team, AppSettings } from '../types';
import TeamLogo from './TeamLogo';

interface LeagueTableProps {
  table: LeagueTableRow[];
  playerTeam: Team;
  shapeTheme: AppSettings['shapeTheme'];
  t: (key: string, params?: { [key: string]: string | number }) => string;
}

const LeagueTable: React.FC<LeagueTableProps> = ({ table, playerTeam, shapeTheme, t }) => {
  return (
    <div className="w-full bg-slate-800/80 rounded-xl shadow-2xl overflow-hidden border border-slate-700">
      <table className="w-full text-white">
        <thead className="bg-slate-900/70">
          <tr>
            <th className="p-2 md:p-3 text-left font-semibold text-slate-400">{t('table_header_rank')}</th>
            <th className="p-2 md:p-3 text-left font-semibold text-slate-400">{t('table_header_team')}</th>
            <th className="p-2 md:p-3 text-center font-semibold text-slate-400" title={t('table_header_played_title')}>{t('table_header_played')}</th>
            <th className="hidden md:table-cell p-3 text-center font-semibold text-slate-400" title={t('table_header_won_title')}>{t('table_header_won')}</th>
            <th className="hidden md:table-cell p-3 text-center font-semibold text-slate-400" title={t('table_header_drawn_title')}>{t('table_header_drawn')}</th>
            <th className="hidden md:table-cell p-3 text-center font-semibold text-slate-400" title={t('table_header_lost_title')}>{t('table_header_lost')}</th>
            <th className="p-2 md:p-3 text-center font-semibold text-slate-400" title={t('table_header_gd_title')}>{t('table_header_gd')}</th>
            <th className="p-2 md:p-3 text-center font-semibold text-slate-400" title={t('table_header_points_title')}>{t('table_header_points')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/50">
          {table.map((row, index) => (
            <tr key={row.team.abbr} className={`transition-colors duration-200 ${row.team.id === playerTeam.id ? 'bg-sky-600/30' : index % 2 === 0 ? 'bg-slate-800/40' : 'bg-slate-800/20'} hover:bg-slate-700/50`}>
              <td className="p-2 md:p-3 text-center w-12 font-semibold text-slate-300">{index + 1}</td>
              <td className="p-2 md:p-3 flex items-center gap-3">
                <TeamLogo team={row.team} size={window.innerWidth < 768 ? 24 : 32} shapeTheme={shapeTheme} />
                <span className="font-bold text-sm md:text-base truncate">{row.team.name}</span>
              </td>
              <td className="p-2 md:p-3 text-center font-semibold">{row.played}</td>
              <td className="hidden md:table-cell p-3 text-center text-slate-300">{row.won}</td>
              <td className="hidden md:table-cell p-3 text-center text-slate-300">{row.drawn}</td>
              <td className="hidden md:table-cell p-3 text-center text-slate-300">{row.lost}</td>
              <td className="p-2 md:p-3 text-center text-slate-300">{row.goalDifference}</td>
              <td className="p-2 md:p-3 text-center font-extrabold text-base md:text-lg">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default LeagueTable;
