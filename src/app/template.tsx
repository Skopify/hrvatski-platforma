/*
  Elke navigatie monteert deze wrapper opnieuw, dus de ingang speelt bij elke
  pagina: de inhoud kantelt uit de diepte naar voren (`.page-enter`). Kort
  genoeg om nooit in de weg te zitten; niets wacht erop.
*/
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
