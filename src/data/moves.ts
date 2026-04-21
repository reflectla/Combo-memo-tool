import { MoveDef } from '../types';

export const MOVES: MoveDef[] = [
    // Normals
    { id: 'LP', name: 'LP', input: 'LP', type: 'normal' },
    { id: 'MP', name: 'MP', input: 'MP', type: 'normal' },
    { id: 'HP', name: 'HP', input: 'HP', type: 'normal' },
    { id: 'LK', name: 'LK', input: 'LK', type: 'normal' },
    { id: 'MK', name: 'MK', input: 'MK', type: 'normal' },
    { id: 'HK', name: 'HK', input: 'HK', type: 'normal' },

    // Command Normals
    { id: '6HP', name: 'F.HP', input: '6HP', type: 'normal' },
    { id: '4HP', name: 'B.HP', input: '4HP', type: 'normal' },

    // Specials
    { id: '236P', name: 'Hadoken', input: '236P', type: 'special' },
    { id: '623P', name: 'Shoryuken', input: '623P', type: 'special' },
    { id: '214K', name: 'Tatsumaki', input: '214K', type: 'special' },

    // Level 3
    { id: '236236P', name: 'SA3', input: '236236P', type: 'super' },
];

export const getMoveById = (id: string): MoveDef | undefined => {
    return MOVES.find(m => m.id === id);
}
