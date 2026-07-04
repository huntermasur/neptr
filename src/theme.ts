import pc from "picocolors";

/** NEPTR - black-and-white line art, close-up with fork arm. */
export const NEPTR_BANNER = String.raw`
                                        
@@@@@@@@@@@@@C ^@@@@@@@@@@@@@@@@@@@@@@ @@  @@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@"@@.@@@@@@@@@@@@@@@@@@@@ @@@@@@@  @@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@'B@'B@@@@@@@@@@@@@@@@@@ @@@@@@@@@@@@@@  @@@@@@@@@@@@@@
@@@@@@@@@@@@@@@!B@r%@@@@@@@@@@@@$@@@ @@@@@@@@@@@@@@@@@@@@@@  @@@@@@@
@@n@@^B@@@@@@@@@qh@MQ@@@@@@@@@@@@@@m@@@B     o@@@@@@@@@@@@@@@@@@  @@
@@@'B@X8@@@@@@@@@B<@B;@@@@@@@@@@@@@ @@B B@@@% *@@@@@@@@%m%B@@@@@@@@
@@@@wh@%@@@@@@@@@@B.B@.@@@@@@@@@@@ %@@$ B@@@@ k@@@@@@' W@& .@@@@@@@@
@@@@@BI@B'@@@@@@@@@@'B$.B@@@@@@@@@ $@$@m @@@ r@@@@@@W B@@@@ m@@@@@@
@@@@@@@.B@.@@@@@$$@k @B B@@@@@@@$ @$@@$@@@B@@$@@@@@@@ 8@@@d B@@@@@@
@@@@@@@@,B@{@@@@B'%@0I@@@@@@@@@@B @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ @
@@@@@@@@@aO@WC{(@@@B}@@@@@@@@@@@ @@@@@   \/@@@@@@@@@@@@@   @@@@@@@ @
@@@@@@@@@@B'@@@^*:@@'B@@@@@@@@@@ @@$@@       \/   \/   \/  @@@@@@ @@
@@@@@@@@@@@@>~@@@@Q~@qp@@@@@@@@ @@@@@@@                  @@@@@@@@ @@
@@@@@@@@@@@@@@@@@@@B'@B.@@@@@@@ @@@@@@@@@             @Bh@@@@@@@ @@@
@@@@@@@@@@@@@@@@@@@@@'B@.@@@@@ @@@@@@@@@@@@@@@@@@@@@@@@@&?@@@@@@ @@@
@@@@@@@@@@@@@@@@@@@@@@0M@~B@@w @@@@@@$@@@@@@@@@@@@B@B8@B$@@@@@@ @@@@
@@@@@@@@@@@@@@@@@@@@@@@B!@B0B @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ @@@@
@@@@@@@@@@@@@@@@@@@@@@@@@.@B  @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ @@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ @@@@@

                              N E P T R
`;

export const QUOTES = [
  "NEPTR, deploy!",
  "I will go into your project and fix it like a magic doctor!",
  "Fresh pie for your codebase!",
  "Hello Creator!",
  "Let me bake you something beautiful today.",
  "My laser arm is calibrated for precision scaffolding!",
];

export function randomQuote(): string {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)]!;
}

export const neptr = {
  say: (msg: string) => console.log(`${pc.green("◉ NEPTR:")} ${msg}`),
  warn: (msg: string) => console.log(`${pc.yellow("◉ NEPTR (heartbroken):")} ${msg}`),
  error: (msg: string) => console.log(`${pc.red("◉ NEPTR (overheating):")} ${msg}`),
  success: (msg: string) => console.log(`${pc.green("◉ NEPTR (dancing):")} ${msg}`),
};
