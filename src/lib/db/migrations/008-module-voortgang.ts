/**
 * Voortgang per grammaticamodule.
 *
 * Lessen onthouden sinds het begin welke oefeningen je gehad hebt, en «Les
 * hervatten» pakt daar weer op. Modules kregen datzelfde nooit: hun sessie
 * draaide op `kind: "review"`, en dat pad schrijft niets weg. Wie een module van
 * eenendertig stappen halverwege verliet, begon de volgende keer weer bij stap
 * één — en gaf het dan meestal op, want de eerste stappen zijn juist de uitleg
 * die je al gelezen had.
 *
 * Dezelfde vorm als `lesson_progress`, met de modulecode als sleutel. Twee
 * afwijkingen: er is geen `status`, want een module is nooit op slot, en
 * `steps_done` wordt bij het afronden geleegd — wie de module opnieuw doet,
 * hoort weer vooraan te beginnen in plaats van meteen op het eindscherm.
 */
export const sql = `
CREATE TABLE module_progress (
  code TEXT PRIMARY KEY,
  steps_done TEXT NOT NULL DEFAULT '[]',
  started_at INTEGER,
  completed_at INTEGER
);
`;
