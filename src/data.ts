import type { FighterCard, FighterDef, RarityDef, RarityId } from "./types.js";

// ── Rarity definitions ────────────────────────────────────────────────────────
export const RARITIES: RarityDef[] = [
  {
    id: "mythic",
    label: "Mythic",
    color: 0xe67e22,
    emoji: "👑",
    catchReward: 300,
  },
  {
    id: "legendary",
    label: "Legendary",
    color: 0xf1c40f,
    emoji: "🌟",
    catchReward: 100,
  },
  {
    id: "epic",
    label: "Epic",
    color: 0x9b59d0,
    emoji: "🟣",
    catchReward: 75,
  },
  {
    id: "rare",
    label: "Rare",
    color: 0x4f8fdf,
    emoji: "🔵",
    catchReward: 50,
  },
];

// ── Real MMA fighter database ─────────────────────────────────────────────────
// All fighters, divisions, and power ratings are based on the user's source data.

const FIGHTERS: FighterDef[] = [
  // ── Mythic ──────────────────────────────────────────────────────────────────
  { name: "Jon Jones", division: "Light Heavyweight", rarity: "mythic", power: 100 },
  { name: "Amanda Nunes", division: "Bantamweight", rarity: "mythic", power: 100 },
  { name: "Georges St-Pierre", division: "Welterweight", rarity: "mythic", power: 99 },
  { name: "Anderson Silva", division: "Middleweight", rarity: "mythic", power: 99 },
  { name: "Khabib Nurmagomedov", division: "Lightweight", rarity: "mythic", power: 99 },
  { name: "Demetrious Johnson", division: "Flyweight", rarity: "mythic", power: 99 },
  { name: "Daniel Cormier", division: "Light Heavyweight", rarity: "mythic", power: 99 },
  { name: "Fedor Emelianenko", division: "Heavyweight", rarity: "mythic", power: 99 },
  { name: "Cris Cyborg", division: "Featherweight", rarity: "mythic", power: 99 },
  { name: "Alex Pereira", division: "Middleweight", rarity: "mythic", power: 99 },
  { name: "Islam Makhachev", division: "Lightweight", rarity: "mythic", power: 99 },
  { name: "Ilia Topuria", division: "Featherweight", rarity: "mythic", power: 99 },
  { name: "Tom Aspinall", division: "Heavyweight", rarity: "mythic", power: 99 },
  { name: "José Aldo", division: "Featherweight", rarity: "mythic", power: 98 },
  { name: "Stipe Miocic", division: "Heavyweight", rarity: "mythic", power: 98 },
  { name: "Alexander Volkanovski", division: "Featherweight", rarity: "mythic", power: 98 },
  { name: "Israel Adesanya", division: "Middleweight", rarity: "mythic", power: 98 },
  { name: "Khamzat Chimaev", division: "Middleweight", rarity: "mythic", power: 98 },
  { name: "Randy Couture", division: "Heavyweight", rarity: "mythic", power: 97 },
  { name: "Valentina Shevchenko", division: "Flyweight", rarity: "mythic", power: 97 },
  { name: "Zhang Weili", division: "Strawweight", rarity: "mythic", power: 97 },
  { name: "Kamaru Usman", division: "Welterweight", rarity: "mythic", power: 97 },
  { name: "Patricio Pitbull", division: "Featherweight", rarity: "mythic", power: 97 },
  { name: "Conor McGregor", division: "Featherweight", rarity: "mythic", power: 96 },
  { name: "Max Holloway", division: "Featherweight", rarity: "mythic", power: 96 },
  { name: "Matt Hughes", division: "Welterweight", rarity: "mythic", power: 96 },
  { name: "Henry Cejudo", division: "Flyweight", rarity: "mythic", power: 96 },
  { name: "Joanna Jędrzejczyk", division: "Strawweight", rarity: "mythic", power: 96 },
  { name: "Charles Oliveira", division: "Lightweight", rarity: "mythic", power: 96 },
  { name: "Bas Rutten", division: "Heavyweight", rarity: "mythic", power: 96 },
  { name: "Petr Yan", division: "Bantamweight", rarity: "mythic", power: 95 },
  { name: "Tyron Woodley", division: "Welterweight", rarity: "mythic", power: 95 },

  // ── Legendary ───────────────────────────────────────────────────────────────
  { name: "Cain Velasquez", division: "Heavyweight", rarity: "legendary", power: 98 },
  { name: "Chuck Liddell", division: "Light Heavyweight", rarity: "legendary", power: 96 },
  { name: "Mirko Cro Cop", division: "Heavyweight", rarity: "legendary", power: 96 },
  { name: "B.J. Penn", division: "Lightweight", rarity: "legendary", power: 95 },
  { name: "Frank Shamrock", division: "Light Heavyweight", rarity: "legendary", power: 95 },
  { name: "Maurício \"Shogun\" Rua", division: "Light Heavyweight", rarity: "legendary", nickname: "Shogun", power: 95 },
  { name: "Robert Whittaker", division: "Middleweight", rarity: "legendary", power: 95 },
  { name: "Merab Dvalishvili", division: "Bantamweight", rarity: "legendary", power: 95 },
  { name: "Shavkat Rakhmonov", division: "Welterweight", rarity: "legendary", power: 95 },
  { name: "Wanderlei Silva", division: "Light Heavyweight", rarity: "legendary", power: 94 },
  { name: "Antônio Rodrigo Nogueira", division: "Heavyweight", rarity: "legendary", power: 94 },
  { name: "Dominick Cruz", division: "Bantamweight", rarity: "legendary", power: 94 },
  { name: "T.J. Dillashaw", division: "Bantamweight", rarity: "legendary", power: 94 },
  { name: "Gegard Mousasi", division: "Middleweight", rarity: "legendary", power: 94 },
  { name: "Justin Gaethje", division: "Lightweight", rarity: "legendary", power: 94 },
  { name: "Ronda Rousey", division: "Bantamweight", rarity: "legendary", power: 94 },
  { name: "Dricus du Plessis", division: "Middleweight", rarity: "legendary", power: 94 },
  { name: "Arman Tsarukyan", division: "Lightweight", rarity: "legendary", power: 94 },
  { name: "Magomed Ankalaev", division: "Light Heavyweight", rarity: "legendary", power: 94 },
  { name: "Vitor Belfort", division: "Light Heavyweight", rarity: "legendary", power: 94 },
  { name: "Quinton Jackson", division: "Light Heavyweight", rarity: "legendary", power: 93 },
  { name: "Lyoto Machida", division: "Light Heavyweight", rarity: "legendary", power: 93 },
  { name: "Dan Henderson", division: "Light Heavyweight", rarity: "legendary", power: 93 },
  { name: "Alistair Overeem", division: "Heavyweight", rarity: "legendary", power: 93 },
  { name: "Junior dos Santos", division: "Heavyweight", rarity: "legendary", power: 93 },
  { name: "Fabricio Werdum", division: "Heavyweight", rarity: "legendary", power: 93 },
  { name: "Eddie Alvarez", division: "Lightweight", rarity: "legendary", power: 93 },
  { name: "Dustin Poirier", division: "Lightweight", rarity: "legendary", power: 93 },
  { name: "Leon Edwards", division: "Welterweight", rarity: "legendary", power: 93 },
  { name: "Umar Nurmagomedov", division: "Bantamweight", rarity: "legendary", power: 93 },
  { name: "Frankie Edgar", division: "Lightweight", rarity: "legendary", power: 92 },
  { name: "Urijah Faber", division: "Bantamweight", rarity: "legendary", power: 92 },
  { name: "Luke Rockhold", division: "Middleweight", rarity: "legendary", power: 92 },
  { name: "Yoel Romero", division: "Middleweight", rarity: "legendary", power: 92 },
  { name: "Rose Namajunas", division: "Strawweight", rarity: "legendary", power: 92 },
  { name: "Aljamain Sterling", division: "Bantamweight", rarity: "legendary", power: 92 },
  { name: "Jiří Procházka", division: "Light Heavyweight", rarity: "legendary", power: 92 },
  { name: "Michael Morales", division: "Welterweight", rarity: "legendary", power: 92 },
  { name: "Joseph Benavidez", division: "Flyweight", rarity: "legendary", power: 92 },
  { name: "Kazushi Sakuraba", division: "Middleweight", rarity: "legendary", power: 92 },
  { name: "Rashad Evans", division: "Light Heavyweight", rarity: "legendary", power: 92 },
  { name: "Glover Teixeira", division: "Light Heavyweight", rarity: "legendary", power: 92 },
  { name: "Vadim Nemkov", division: "Light Heavyweight", rarity: "legendary", power: 92 },
  { name: "Chris Weidman", division: "Middleweight", rarity: "legendary", power: 91 },
  { name: "Jacare Souza", division: "Middleweight", rarity: "legendary", power: 91 },
  { name: "Josh Barnett", division: "Heavyweight", rarity: "legendary", power: 91 },
  { name: "Rory MacDonald", division: "Welterweight", rarity: "legendary", power: 91 },
  { name: "Robbie Lawler", division: "Welterweight", rarity: "legendary", power: 91 },
  { name: "Benson Henderson", division: "Lightweight", rarity: "legendary", power: 91 },
  { name: "Renan Barao", division: "Bantamweight", rarity: "legendary", power: 91 },
  { name: "Cory Sandhagen", division: "Bantamweight", rarity: "legendary", power: 91 },
  { name: "Sean O'Malley", division: "Bantamweight", rarity: "legendary", power: 91 },
  { name: "Brandon Moreno", division: "Flyweight", rarity: "legendary", power: 91 },
  { name: "Alexandre Pantoja", division: "Flyweight", rarity: "legendary", power: 91 },
  { name: "Belal Muhammad", division: "Welterweight", rarity: "legendary", power: 91 },
  { name: "Jack Della Maddalena", division: "Welterweight", rarity: "legendary", power: 91 },
  { name: "Manon Fiorot", division: "Flyweight", rarity: "legendary", power: 91 },
  { name: "Tatiana Suarez", division: "Strawweight", rarity: "legendary", power: 91 },
  { name: "Sean Strickland", division: "Middleweight", rarity: "legendary", power: 91 },
  { name: "Sergei Pavlovich", division: "Heavyweight", rarity: "legendary", power: 91 },
  { name: "Curtis Blaydes", division: "Heavyweight", rarity: "legendary", power: 91 },
  { name: "Demian Maia", division: "Welterweight", rarity: "legendary", power: 91 },
  { name: "Shinya Aoki", division: "Lightweight", rarity: "legendary", power: 91 },
  { name: "Diego Lopes", division: "Featherweight", rarity: "legendary", power: 91 },
  { name: "Deiveson Figueiredo", division: "Flyweight", rarity: "legendary", power: 91 },
  { name: "Tito Ortiz", division: "Light Heavyweight", rarity: "legendary", power: 91 },
  { name: "Ryan Bader", division: "Light Heavyweight", rarity: "legendary", power: 91 },
  { name: "Douglas Lima", division: "Welterweight", rarity: "legendary", power: 90 },
  { name: "Chad Mendes", division: "Featherweight", rarity: "legendary", power: 90 },
  { name: "Tony Ferguson", division: "Lightweight", rarity: "legendary", power: 90 },
  { name: "Colby Covington", division: "Welterweight", rarity: "legendary", power: 90 },
  { name: "Movsar Evloev", division: "Featherweight", rarity: "legendary", power: 90 },
  { name: "Jessica Andrade", division: "Strawweight", rarity: "legendary", power: 90 },
  { name: "Jamahal Hill", division: "Light Heavyweight", rarity: "legendary", power: 90 },
  { name: "Johny Hendricks", division: "Welterweight", rarity: "legendary", power: 90 },
  { name: "Michael Bisping", division: "Middleweight", rarity: "legendary", power: 89 },
  { name: "Gilbert Melendez", division: "Lightweight", rarity: "epic", power: 87 },
  { name: "Carlos Condit", division: "Welterweight", rarity: "legendary", power: 89 },
  { name: "Stephen Thompson", division: "Welterweight", rarity: "legendary", power: 89 },
  { name: "Anthony Pettis", division: "Lightweight", rarity: "legendary", power: 89 },
  { name: "Brian Ortega", division: "Featherweight", rarity: "legendary", power: 89 },
  { name: "Michael Chandler", division: "Lightweight", rarity: "legendary", power: 89 },
  { name: "Sean Brady", division: "Welterweight", rarity: "legendary", power: 89 },
  { name: "Alexa Grasso", division: "Flyweight", rarity: "legendary", power: 89 },
  { name: "Chael Sonnen", division: "Middleweight", rarity: "legendary", power: 89 },
  { name: "Chan Sung Jung", division: "Featherweight", rarity: "legendary", power: 89 },
  { name: "Takanori Gomi", division: "Lightweight", rarity: "legendary", power: 89 },
  { name: "Rich Franklin", division: "Middleweight", rarity: "epic", power: 88 },
  { name: "Erin Blanchfield", division: "Flyweight", rarity: "legendary", power: 88 },
  { name: "Nassourdine Imavov", division: "Middleweight", rarity: "legendary", power: 88 },
  { name: "Carlos Ulberg", division: "Light Heavyweight", rarity: "legendary", power: 88 },
  { name: "Frank Mir", division: "Heavyweight", rarity: "legendary", power: 88 },
  { name: "Rafael dos Anjos", division: "Lightweight", rarity: "legendary", power: 88 },
  { name: "Edson Barboza", division: "Lightweight", rarity: "legendary", power: 88 },
  { name: "Gilbert Burns", division: "Welterweight", rarity: "legendary", power: 88 },
  { name: "Jake Shields", division: "Welterweight", rarity: "legendary", power: 88 },
  { name: "Holly Holm", division: "Bantamweight", rarity: "legendary", power: 88 },
  { name: "Carla Esparza", division: "Strawweight", rarity: "legendary", power: 88 },
  { name: "Miesha Tate", division: "Bantamweight", rarity: "legendary", power: 87 },
  { name: "Mateusz Gamrot", division: "Lightweight", rarity: "legendary", power: 87 },
  { name: "Jailton Almeida", division: "Heavyweight", rarity: "legendary", power: 87 },
  { name: "Derrick Lewis", division: "Heavyweight", rarity: "legendary", power: 87 },
  { name: "Jared Cannonier", division: "Middleweight", rarity: "legendary", power: 87 },
  { name: "Forrest Griffin", division: "Light Heavyweight", rarity: "legendary", power: 87 },
  { name: "Gray Maynard", division: "Lightweight", rarity: "legendary", power: 87 },
  { name: "Donald Cerrone", division: "Lightweight", rarity: "legendary", power: 87 },
  { name: "Mark Hunt", division: "Heavyweight", rarity: "epic", power: 86 },
  { name: "Nick Diaz", division: "Welterweight", rarity: "legendary", power: 86 },
  { name: "Cody Garbrandt", division: "Bantamweight", rarity: "legendary", power: 86 },
  { name: "Germaine de Randamie", division: "Featherweight", rarity: "legendary", power: 86 },
  { name: "Ian Machado Garry", division: "Welterweight", rarity: "legendary", power: 86 },
  { name: "Brandon Royval", division: "Flyweight", rarity: "legendary", power: 86 },
  { name: "Marvin Vettori", division: "Middleweight", rarity: "legendary", power: 86 },
  { name: "Paulo Costa", division: "Middleweight", rarity: "legendary", power: 86 },
  { name: "Alexander Volkov", division: "Heavyweight", rarity: "legendary", power: 86 },
  { name: "Andrei Arlovski", division: "Heavyweight", rarity: "legendary", power: 86 },
  { name: "Beneil Dariush", division: "Lightweight", rarity: "legendary", power: 86 },
  { name: "Yair Rodriguez", division: "Featherweight", rarity: "legendary", power: 86 },
  { name: "Lerone Murphy", division: "Featherweight", rarity: "epic", power: 86 },
  { name: "Rafael Fiziev", division: "Lightweight", rarity: "epic", power: 85 },
  { name: "Julianna Peña", division: "Bantamweight", rarity: "legendary", power: 84 },
  { name: "Yan Xiaonan", division: "Strawweight", rarity: "legendary", power: 84 },
  { name: "Yushin Okami", division: "Middleweight", rarity: "legendary", power: 84 },
  { name: "Marlon Moraes", division: "Bantamweight", rarity: "epic", power: 84 },
  { name: "Vicente Luque", division: "Welterweight", rarity: "epic", power: 84 },
  { name: "Manel Kape", division: "Flyweight", rarity: "epic", power: 84 },
  { name: "Arnold Allen", division: "Featherweight", rarity: "epic", power: 84 },
  { name: "Josh Emmett", division: "Featherweight", rarity: "epic", power: 84 },
  { name: "Marlon Vera", division: "Bantamweight", rarity: "epic", power: 84 },
  { name: "Claudia Gadelha", division: "Strawweight", rarity: "epic", power: 84 },
  { name: "Corey Anderson", division: "Light Heavyweight", rarity: "epic", power: 84 },
  { name: "Phil Davis", division: "Light Heavyweight", rarity: "epic", power: 84 },
  { name: "Raquel Pennington", division: "Bantamweight", rarity: "legendary", power: 84 },
  { name: "Jim Miller", division: "Lightweight", rarity: "legendary", power: 83 },
  { name: "Renato Moicano", division: "Lightweight", rarity: "epic", power: 83 },
  { name: "Caio Borralho", division: "Middleweight", rarity: "epic", power: 83 },
  { name: "Kelvin Gastelum", division: "Middleweight", rarity: "epic", power: 83 },
  { name: "Chris Curtis", division: "Middleweight", rarity: "epic", power: 78 },
  { name: "Khalil Rountree Jr.", division: "Light Heavyweight", rarity: "epic", power: 83 },
  { name: "Calvin Kattar", division: "Featherweight", rarity: "epic", power: 83 },
  { name: "Virna Jandiroba", division: "Strawweight", rarity: "epic", power: 83 },
  { name: "Michael Page", division: "Welterweight", rarity: "epic", power: 83 },
  { name: "Dan Hooker", division: "Lightweight", rarity: "epic", power: 82 },
  { name: "Kevin Holland", division: "Welterweight", rarity: "epic", power: 82 },
  { name: "Kevin Lee", division: "Welterweight", rarity: "epic", power: 82 },
  { name: "John Lineker", division: "Bantamweight", rarity: "epic", power: 82 },
  { name: "Mackenzie Dern", division: "Strawweight", rarity: "epic", power: 82 },
  { name: "Amanda Lemos", division: "Strawweight", rarity: "epic", power: 82 },
  { name: "Brendan Allen", division: "Middleweight", rarity: "epic", power: 82 },
  { name: "Aleksandar Rakić", division: "Light Heavyweight", rarity: "epic", power: 82 },
  { name: "Dominick Reyes", division: "Light Heavyweight", rarity: "epic", power: 82 },
  { name: "Thiago Santos", division: "Light Heavyweight", rarity: "epic", power: 82 },
  { name: "Nate Marquardt", division: "Middleweight", rarity: "epic", power: 82 },
  { name: "Kai Kara-France", division: "Flyweight", rarity: "epic", power: 82 },
  { name: "Jack Hermansson", division: "Middleweight", rarity: "epic", power: 81 },
  { name: "Jairzinho Rozenstruik", division: "Heavyweight", rarity: "epic", power: 80 },
  { name: "Marcin Tybura", division: "Heavyweight", rarity: "epic", power: 81 },
  { name: "Jussier Formiga", division: "Flyweight", rarity: "epic", power: 81 },
  { name: "Geoff Neal", division: "Welterweight", rarity: "epic", power: 81 },
  { name: "Dong Hyun Kim", division: "Welterweight", rarity: "epic", power: 81 },
  { name: "Giga Chikadze", division: "Featherweight", rarity: "epic", power: 81 },
  { name: "Marina Rodriguez", division: "Strawweight", rarity: "epic", power: 81 },
  { name: "Paddy Pimblett", division: "Lightweight", rarity: "epic", power: 81 },
  { name: "Joaquin Buckley", division: "Welterweight", rarity: "epic", power: 80 },
  { name: "Alex Perez", division: "Flyweight", rarity: "epic", power: 80 },
  { name: "Amir Albazi", division: "Flyweight", rarity: "epic", power: 80 },
  { name: "Volkan Oezdemir", division: "Light Heavyweight", rarity: "epic", power: 80 },
  { name: "Nikita Krylov", division: "Light Heavyweight", rarity: "epic", power: 80 },
  { name: "John Dodson", division: "Flyweight", rarity: "epic", power: 80 },
  { name: "Grant Dawson", division: "Lightweight", rarity: "epic", power: 80 },
  { name: "Michel Pereira", division: "Welterweight", rarity: "epic", power: 80 },
  { name: "Cub Swanson", division: "Featherweight", rarity: "epic", power: 80 },
  { name: "Jorge Masvidal", division: "Welterweight", rarity: "epic", power: 80 },
  { name: "Darren Till", division: "Welterweight", rarity: "epic", power: 79 },
  { name: "Benoît Saint Denis", division: "Lightweight", rarity: "epic", power: 79 },
  { name: "Rob Font", division: "Bantamweight", rarity: "epic", power: 79 },
  { name: "Diego Ferreira", division: "Lightweight", rarity: "epic", power: 79 },
  { name: "Drew Dober", division: "Lightweight", rarity: "epic", power: 79 },
  { name: "Al Iaquinta", division: "Lightweight", rarity: "epic", power: 79 },
  { name: "Keith Jardine", division: "Light Heavyweight", rarity: "epic", power: 79 },
  { name: "Matt Serra", division: "Welterweight", rarity: "epic", power: 78 },
  { name: "Nate Diaz", division: "Lightweight", rarity: "epic", power: 78 },
  { name: "Jalin Turner", division: "Lightweight", rarity: "epic", power: 78 },
  { name: "Bobby Green", division: "Lightweight", rarity: "epic", power: 78 },
  { name: "Dan Hardy", division: "Welterweight", rarity: "epic", power: 78 },
  { name: "Rousimar Palhares", division: "Welterweight", rarity: "epic", power: 78 },
  { name: "Bryce Mitchell", division: "Featherweight", rarity: "epic", power: 78 },
  { name: "Dan Ige", division: "Featherweight", rarity: "epic", power: 78 },
  { name: "Natalia Silva", division: "Flyweight", rarity: "epic", power: 78 },
  { name: "Katlyn Cerminara", division: "Flyweight", rarity: "epic", power: 78 },
  { name: "Clay Guida", division: "Lightweight", rarity: "epic", power: 78 },
  { name: "Johnny Walker", division: "Light Heavyweight", rarity: "epic", power: 78 },
  { name: "Tai Tuivasa", division: "Heavyweight", rarity: "epic", power: 76 },
  { name: "Aleksei Oleinik", division: "Heavyweight", rarity: "epic", power: 77 },
  { name: "Sodiq Yusuff", division: "Featherweight", rarity: "epic", power: 77 },
  { name: "Darren Elkins", division: "Featherweight", rarity: "epic", power: 77 },
  { name: "Patrick Côté", division: "Middleweight", rarity: "epic", power: 77 },
  { name: "Michael Johnson", division: "Lightweight", rarity: "epic", power: 77 },
  { name: "Jennifer Maia", division: "Flyweight", rarity: "epic", power: 77 },
  { name: "Jeremy Stephens", division: "Featherweight", rarity: "epic", power: 76 },
  { name: "Maycee Barber", division: "Flyweight", rarity: "epic", power: 76 },
  { name: "Roman Dolidze", division: "Middleweight", rarity: "epic", power: 76 },
  { name: "Thiago Silva", division: "Light Heavyweight", rarity: "epic", power: 76 },
  { name: "Melvin Guillard", division: "Lightweight", rarity: "epic", power: 76 },
  { name: "Evan Dunham", division: "Lightweight", rarity: "epic", power: 75 },
  { name: "Joe Lauzon", division: "Lightweight", rarity: "epic", power: 75 },
  { name: "Joshua Van", division: "Flyweight", rarity: "rare", power: 75 },
  { name: "Lauren Murphy", division: "Flyweight", rarity: "epic", power: 73 },
  { name: "Jessica Eye", division: "Flyweight", rarity: "epic", power: 73 },
  { name: "Steve Erceg", division: "Flyweight", rarity: "rare", power: 73 },
  { name: "King Green", division: "Lightweight", rarity: "rare", power: 73 },
  { name: "Kyler Phillips", division: "Bantamweight", rarity: "rare", power: 72 },
  { name: "Alonzo Menifield", division: "Light Heavyweight", rarity: "rare", power: 72 },
  { name: "Michelle Waterson", division: "Strawweight", rarity: "epic", power: 72 },
  { name: "Adrian Yanez", division: "Bantamweight", rarity: "rare", power: 71 },
  { name: "Brad Pickett", division: "Bantamweight", rarity: "epic", power: 71 },
  { name: "Matt Frevola", division: "Lightweight", rarity: "rare", power: 71 },
  { name: "Jasmine Jasudavicius", division: "Bantamweight", rarity: "rare", power: 70 },
  { name: "Thiago Moisés", division: "Lightweight", rarity: "rare", power: 70 },
  { name: "Waldo Cortes-Acosta", division: "Heavyweight", rarity: "rare", power: 69 },
  { name: "Jared Gordon", division: "Lightweight", rarity: "rare", power: 69 },
  { name: "Tecia Pennington", division: "Strawweight", rarity: "epic", power: 69 },
  { name: "Tim Elliott", division: "Flyweight", rarity: "rare", power: 68 },
  { name: "Raul Rosas Jr.", division: "Bantamweight", rarity: "rare", power: 67 },
  { name: "Alan Belcher", division: "Middleweight", rarity: "rare", power: 67 },
  { name: "Marc Diakiese", division: "Lightweight", rarity: "rare", power: 66 },
  { name: "Ion Cuțelaba", division: "Light Heavyweight", rarity: "rare", power: 65 },
  { name: "Diego Brandao", division: "Featherweight", rarity: "rare", power: 64 },
  { name: "Damir Hadžović", division: "Lightweight", rarity: "rare", power: 62 },
  { name: "Paulo Thiago", division: "Welterweight", rarity: "rare", power: 62 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateFighterId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

// ── Spawn weighting ───────────────────────────────────────────────────────────
// Auto-spawns (and /spawn, /spawnnow, /massspawn) are power-weighted: a fighter's
// odds fall off the stronger they are, so low-power fighters show up often and
// elite fighters are genuinely rare.

/** Lowest power in the database — treated as the "common" baseline. */
const SPAWN_BASE_POWER = 62;
/**
 * Every +N power above the baseline roughly halves a fighter's spawn odds.
 * Raise this to make elite fighters even rarer; lower it to flatten the curve.
 */
const SPAWN_POWER_HALFLIFE = 7;

/** Relative spawn weight for a fighter of the given power. Always > 0. */
function spawnWeight(power: number): number {
  const above = Math.max(0, power - SPAWN_BASE_POWER);
  return Math.pow(0.5, above / SPAWN_POWER_HALFLIFE);
}

/** Pick a fighter from the database with power-weighted rarity. */
function pickWeightedFighter(): FighterDef {
  let total = 0;
  const weights: number[] = new Array(FIGHTERS.length);
  for (let i = 0; i < FIGHTERS.length; i++) {
    const w = spawnWeight(FIGHTERS[i]!.power);
    weights[i] = w;
    total += w;
  }

  let roll = Math.random() * total;
  for (let i = 0; i < FIGHTERS.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return FIGHTERS[i]!;
  }
  return FIGHTERS[FIGHTERS.length - 1]!;
}

/**
 * Pull a random fighter from the static database and mint a card for the given
 * owner. Higher-power fighters are progressively rarer (see SPAWN weighting).
 */
export function generateFighter(ownerId: string): FighterCard {
  const def = pickWeightedFighter();
  return {
    id: generateFighterId(),
    name: def.name,
    nickname: def.nickname,
    division: def.division,
    rarity: def.rarity,
    power: def.power,
    ownerId,
    caughtAt: Date.now(),
  };
}

/** Mint a card for a specific fighter by name from the static database. Returns null if not found. */
export function mintFighterByName(name: string, ownerId: string): FighterCard | null {
  const def = FIGHTERS.find(
    (f) => f.name.toLowerCase() === name.toLowerCase(),
  );
  if (!def) return null;
  return {
    id: generateFighterId(),
    name: def.name,
    nickname: def.nickname,
    division: def.division,
    rarity: def.rarity,
    power: def.power,
    ownerId,
    caughtAt: Date.now(),
  };
}

/** Mint a random card of a specific rarity from the static database. */
export function generateFighterOfRarity(ownerId: string, rarity: RarityId): FighterCard {
  const pool = FIGHTERS.filter((f) => f.rarity === rarity);
  const def = pool.length > 0 ? pick(pool) : pick(FIGHTERS);
  return {
    id: generateFighterId(),
    name: def.name,
    nickname: def.nickname,
    division: def.division,
    rarity: def.rarity,
    power: def.power,
    ownerId,
    caughtAt: Date.now(),
  };
}

/** All static fighter definitions, useful for autocomplete in admin commands. */
export function getAllFighters(): readonly FighterDef[] {
  return FIGHTERS;
}

export function rarityLabel(id: RarityId): string {
  return RARITIES.find((r) => r.id === id)?.label ?? "Rare";
}

export function rarityDef(id: RarityId): RarityDef {
  return RARITIES.find((r) => r.id === id) ?? RARITIES[3]!;
}

// ── Record generation (deterministic from name + power) ────────────────────────

function simpleHash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Generate a plausible MMA record string "W-L-D" from name and power. */
export function makeRecord(name: string, power: number): string {
  const h = simpleHash(name);
  const wins = 10 + Math.floor(power * 0.15) + (h % 14);
  const losses = Math.min(Math.floor(power * 0.05 + (h % 7)), 12);
  const draws = h % 3;
  return `${wins}-${losses}-${draws}`;
}

/** Get the rank of a fighter within their division (1 = top). Ties share the same rank. */
export function getDivisionRank(fighter: { name: string; division: string; power: number }): number {
  // We need the module-level FIGHTERS array; it's accessed via closure.
  // Pre-compute on first call.
  const rankMap = getDivisionRankMap();
  return rankMap[fighter.division]?.[fighter.name] ?? 1;
}

let divisionRankMap: Record<string, Record<string, number>> | null = null;

function getDivisionRankMap(): Record<string, Record<string, number>> {
  if (divisionRankMap) return divisionRankMap;

  const map: Record<string, Record<string, number>> = {};
  const byDivision: Record<string, { name: string; power: number }[]> = {};

  for (const f of FIGHTERS) {
    (byDivision[f.division] ??= []).push({ name: f.name, power: f.power });
  }

  for (const [div, fighters] of Object.entries(byDivision)) {
    fighters.sort((a, b) => b.power - a.power);
    const ranks: Record<string, number> = {};
    let rank = 1;
    for (let i = 0; i < fighters.length; i++) {
      if (i > 0 && fighters[i].power < fighters[i - 1].power) rank = i + 1;
      ranks[fighters[i].name] = rank;
    }
    map[div] = ranks;
  }

  divisionRankMap = map;
  return map;
}