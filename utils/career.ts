import { Career, Team, League, LeagueInfo, EuropeanCompetition } from '../types';
import { LEAGUES } from '../constants';
import { generateFixtures, calculateLeagueTable, generateTournamentBracket } from './gameModes';

const CAREER_STORAGE_KEY = 'parmak_futbolu_career';

export const loadCareer = (): Career | null => {
  const saved = localStorage.getItem(CAREER_STORAGE_KEY);
  return saved ? JSON.parse(saved) : null;
};

export const saveCareer = (career: Career): void => {
  localStorage.setItem(CAREER_STORAGE_KEY, JSON.stringify(career));
};

export const deleteCareer = (): void => {
  localStorage.removeItem(CAREER_STORAGE_KEY);
};

export const createNewCareer = (playerTeam: Team, playerLeagueId: string): Career => {
    const newCareer: Career = {
        playerTeamId: playerTeam.id,
        playerLeagueId: playerLeagueId,
        currentSeason: 1,
        leagues: {},
        europeanCompetition: null,
    };

    for (const leagueId in LEAGUES) {
        const leagueInfo: LeagueInfo = LEAGUES[leagueId];
        const fixtures = generateFixtures(leagueInfo.teams);
        const table = calculateLeagueTable(leagueInfo.teams, []);
        
        const leagueData: League = {
            fixtures,
            table,
            currentWeek: 0,
        };
        newCareer.leagues[leagueId] = leagueData;
    }

    saveCareer(newCareer);
    return newCareer;
};

export const advanceToNextSeason = (career: Career): Career => {
    const nextSeasonCareer = JSON.parse(JSON.stringify(career)) as Career;

    // 1. Determine European Qualification
    const playerLeagueTable = career.leagues[career.playerLeagueId].table;
    const playerTeamRank = playerLeagueTable.findIndex(row => row.team.id === career.playerTeamId) + 1;
    
    let europeanCompetition: EuropeanCompetition | null = null;
    
    if (playerTeamRank > 0 && playerTeamRank <= 4) { // Rank is 1-based
        const type = playerTeamRank <= 2 ? 'UCL' : 'UEL';

        // Create a pool of 31 other elite teams for the tournament
        const eliteTeams = Object.values(LEAGUES)
            .flatMap(l => l.teams)
            .filter(t => t.id !== career.playerTeamId)
            .sort(() => 0.5 - Math.random()) // Shuffle
            .slice(0, 31);
        
        const playerTeam = Object.values(LEAGUES).flatMap(l => l.teams).find(t => t.id === career.playerTeamId)!;
        const tournamentTeams = [playerTeam, ...eliteTeams];

        // Create a 32-team knockout tournament
        const bracket = generateTournamentBracket(tournamentTeams, playerTeam, 32, type);
        
        europeanCompetition = {
            type: type,
            status: 'active',
            stage: 'ro32',
            bracket: bracket,
        };
    }
    nextSeasonCareer.europeanCompetition = europeanCompetition;
    
    // 2. Reset domestic leagues
    for (const leagueId in nextSeasonCareer.leagues) {
        const league = nextSeasonCareer.leagues[leagueId];
        const leagueInfo = LEAGUES[leagueId];
        league.currentWeek = 0;
        league.fixtures = generateFixtures(leagueInfo.teams);
        league.table = calculateLeagueTable(leagueInfo.teams, []);
    }
    
    // 3. Increment season
    nextSeasonCareer.currentSeason++;
    
    saveCareer(nextSeasonCareer);
    return nextSeasonCareer;
}