import { Team, Fixture, MatchResult, LeagueTableRow, Tournament, TournamentNode } from '../types';

/**
 * İki YZ takım arasındaki tek bir maçı simüle eder.
 * @returns Rastgele skorlar içeren bir MatchResult nesnesi.
 */
export const simulateMatch = (): MatchResult => {
    return {
        team1Score: Math.floor(Math.random() * 5),
        team2Score: Math.floor(Math.random() * 5),
    };
};

/**
 * Bir lig için çift devreli bir fikstür listesi oluşturur.
 * Her takım diğer her takımla hem evinde hem de deplasmanda oynar.
 */
export const generateFixtures = (teams: Team[]): Fixture[] => {
    const fixtures: Fixture[] = [];
    if (teams.length < 2) return [];

    const scheduleTeams = [...teams];

    if (scheduleTeams.length % 2 !== 0) {
        scheduleTeams.push({ id: 'BAY', name: 'BAY', abbr: 'BAY', color1: '', color2: '', logo: '' });
    }

    const numRounds = scheduleTeams.length - 1;
    const numMatchesPerRound = scheduleTeams.length / 2;
    const firstHalfFixtures: Fixture[] = [];

    for (let round = 0; round < numRounds; round++) {
        for (let match = 0; match < numMatchesPerRound; match++) {
            const team1 = scheduleTeams[match];
            const team2 = scheduleTeams[scheduleTeams.length - 1 - match];
            
            if (team1.name !== 'BAY' && team2.name !== 'BAY') {
                if (match % 2 === 0) {
                    firstHalfFixtures.push({ round: round + 1, team1, team2 });
                } else {
                    firstHalfFixtures.push({ round: round + 1, team1: team2, team2: team1 });
                }
            }
        }

        const lastTeam = scheduleTeams.pop();
        if(lastTeam) {
            scheduleTeams.splice(1, 0, lastTeam);
        }
    }

    const secondHalfFixtures: Fixture[] = firstHalfFixtures.map(f => ({
        round: f.round + numRounds,
        team1: f.team2, // Ev sahibi ve deplasman takımlarını değiştir
        team2: f.team1,
    }));

    return [...firstHalfFixtures, ...secondHalfFixtures];
};

/**
 * Takım listesi ve tamamlanmış fikstürlerden lig tablosunu hesaplar.
 */
export const calculateLeagueTable = (teams: Team[], fixtures: Fixture[]): LeagueTableRow[] => {
    const tableData: { [key: string]: LeagueTableRow } = teams.reduce((acc, team) => {
        acc[team.abbr] = {
            team,
            played: 0,
            won: 0,
            drawn: 0,
            lost: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDifference: 0,
            points: 0,
        };
        return acc;
    }, {} as { [key: string]: LeagueTableRow });

    fixtures.forEach(fixture => {
        if (!fixture.result) return;

        const team1Stats = tableData[fixture.team1.abbr];
        const team2Stats = tableData[fixture.team2.abbr];
        const { team1Score, team2Score } = fixture.result;

        if (!team1Stats || !team2Stats) return;

        team1Stats.played++;
        team2Stats.played++;
        team1Stats.goalsFor += team1Score;
        team2Stats.goalsFor += team2Score;
        team1Stats.goalsAgainst += team2Score;
        team2Stats.goalsAgainst += team1Score;

        if (team1Score > team2Score) {
            team1Stats.won++;
            team1Stats.points += 3;
            team2Stats.lost++;
        } else if (team2Score > team1Score) {
            team2Stats.won++;
            team2Stats.points += 3;
            team1Stats.lost++;
        } else {
            team1Stats.drawn++;
            team2Stats.drawn++;
            team1Stats.points++;
            team2Stats.points++;
        }
    });

    const tableArray = Object.values(tableData);
    tableArray.forEach(row => {
        row.goalDifference = row.goalsFor - row.goalsAgainst;
    });

    tableArray.sort((a, b) => {
        if (a.points !== b.points) return b.points - a.points;
        if (a.goalDifference !== b.goalDifference) return b.goalDifference - b.goalDifference;
        if (a.goalsFor !== b.goalsFor) return b.goalsFor - a.goalsFor;
        return a.team.name.localeCompare(b.team.name);
    });

    return tableArray;
};

/**
 * Creates a knockout tournament bracket for a given number of teams.
 */
export const generateTournamentBracket = (allTeams: Team[], playerTeam: Team, desiredSize: number, name: string): Tournament => {
    const otherTeams = allTeams.filter(t => t.id !== playerTeam.id);

    // Determine the actual size of the tournament based on available teams, rounded down to the nearest power of 2.
    const maxPossibleSize = Math.pow(2, Math.floor(Math.log2(allTeams.length)));
    const finalSize = Math.min(desiredSize, maxPossibleSize);

    const shuffledOthers = [...otherTeams].sort(() => 0.5 - Math.random());
    const tournamentTeams = [playerTeam, ...shuffledOthers.slice(0, finalSize - 1)];
    const finalShuffled = tournamentTeams.sort(() => 0.5 - Math.random());

    const rounds: TournamentNode[][] = [];
    let currentRoundTeams = finalShuffled;
    let matchIdCounter = 0;

    // Generate the first round
    const firstRound: TournamentNode[] = [];
    for (let i = 0; i < currentRoundTeams.length; i += 2) {
        firstRound.push({
            team1: currentRoundTeams[i],
            team2: currentRoundTeams[i + 1],
            matchId: matchIdCounter++,
        });
    }
    rounds.push(firstRound);

    // Generate placeholder rounds for the rest of the bracket
    let numMatchesInNextRound = firstRound.length / 2;
    while (numMatchesInNextRound >= 1) {
        const nextRound: TournamentNode[] = [];
        for (let i = 0; i < numMatchesInNextRound; i++) {
            nextRound.push({ matchId: matchIdCounter++ });
        }
        rounds.push(nextRound);
        numMatchesInNextRound /= 2;
    }

    return {
        name,
        playerTeam,
        rounds: rounds.filter(r => r.length > 0),
        currentRound: 0,
    };
};