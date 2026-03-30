/**
 * Example scene backgrounds (R2) + i18n keys for action prompts — shared by Studio page and Studio chat.
 */
export interface ExampleBackgroundImage {
  url: string
  /** i18n key under `studio.exampleBackgroundPrompts.*` */
  prompt: string
}

export const EXAMPLE_BACKGROUND_IMAGES: ExampleBackgroundImage[] = [
  { url: 'https://r2.fashion-rec.com/example/nature-wallpaper-7541423_1920.jpg', prompt: 'studio.exampleBackgroundPrompts.001' },
  { url: 'https://r2.fashion-rec.com/example/pexels-abdul-ahad-2158214293-35229355.jpg', prompt: 'studio.exampleBackgroundPrompts.002' },
  { url: 'https://r2.fashion-rec.com/example/pexels-adamowicz-adamsky-2149308693-30925021.jpg', prompt: 'studio.exampleBackgroundPrompts.003' },
  { url: 'https://r2.fashion-rec.com/example/pexels-adriannacalvo-23384610.jpg', prompt: 'studio.exampleBackgroundPrompts.004' },
  { url: 'https://r2.fashion-rec.com/example/pexels-alecdoua-34864230.jpg', prompt: 'studio.exampleBackgroundPrompts.005' },
  { url: 'https://r2.fashion-rec.com/example/pexels-alexandre-moreira-2527876-34593721.jpg', prompt: 'studio.exampleBackgroundPrompts.006' },
  { url: 'https://r2.fashion-rec.com/example/pexels-alina-zahorulko-48514961-31445409.jpg', prompt: 'studio.exampleBackgroundPrompts.007' },
  { url: 'https://r2.fashion-rec.com/example/pexels-alina-zahorulko-48514961-31445410.jpg', prompt: 'studio.exampleBackgroundPrompts.008' },
  { url: 'https://r2.fashion-rec.com/example/pexels-alinaskazka-34702608.jpg', prompt: 'studio.exampleBackgroundPrompts.009' },
  { url: 'https://r2.fashion-rec.com/example/pexels-aljona-ovtsinnikova-121486965-24740438.jpg', prompt: 'studio.exampleBackgroundPrompts.010' },
  { url: 'https://r2.fashion-rec.com/example/pexels-alyona-nagel-1468385055-35224891.jpg', prompt: 'studio.exampleBackgroundPrompts.011' },
  { url: 'https://r2.fashion-rec.com/example/pexels-buxteh-30221622.jpg', prompt: 'studio.exampleBackgroundPrompts.012' },
  { url: 'https://r2.fashion-rec.com/example/pexels-casnafu-35129031.jpg', prompt: 'studio.exampleBackgroundPrompts.013' },
  { url: 'https://r2.fashion-rec.com/example/pexels-cheng-shi-song-427082720-33792335.jpg', prompt: 'studio.exampleBackgroundPrompts.014' },
  { url: 'https://r2.fashion-rec.com/example/pexels-christina99999-34801832.jpg', prompt: 'studio.exampleBackgroundPrompts.015' },
  { url: 'https://r2.fashion-rec.com/example/pexels-cigdem-bilgin-2154409770-35014795.jpg', prompt: 'studio.exampleBackgroundPrompts.016' },
  { url: 'https://r2.fashion-rec.com/example/pexels-dario-rawert-724203352-26765041.jpg', prompt: 'studio.exampleBackgroundPrompts.017' },
  { url: 'https://r2.fashion-rec.com/example/pexels-davidexpedition-31225636.jpg', prompt: 'studio.exampleBackgroundPrompts.018' },
  { url: 'https://r2.fashion-rec.com/example/pexels-dawidtkocz-34686175.jpg', prompt: 'studio.exampleBackgroundPrompts.019' },
  { url: 'https://r2.fashion-rec.com/example/pexels-diana-gp-358688833-14714743.jpg', prompt: 'studio.exampleBackgroundPrompts.020' },
  { url: 'https://r2.fashion-rec.com/example/pexels-diego-f-parra-33199-25254926.jpg', prompt: 'studio.exampleBackgroundPrompts.021' },
  { url: 'https://r2.fashion-rec.com/example/pexels-edgar-mosqueda-camacho-544076702-27204878.jpg', prompt: 'studio.exampleBackgroundPrompts.022' },
  { url: 'https://r2.fashion-rec.com/example/pexels-esrannuur-129682465-13820222.jpg', prompt: 'studio.exampleBackgroundPrompts.023' },
  { url: 'https://r2.fashion-rec.com/example/pexels-ezgi-kaya-498261122-35188967.jpg', prompt: 'studio.exampleBackgroundPrompts.024' },
  { url: 'https://r2.fashion-rec.com/example/pexels-galina-kolonitskaia-485466282-35002554.jpg', prompt: 'studio.exampleBackgroundPrompts.025' },
  { url: 'https://r2.fashion-rec.com/example/pexels-holodna-34974763.jpg', prompt: 'studio.exampleBackgroundPrompts.026' },
  { url: 'https://r2.fashion-rec.com/example/pexels-jan-korgaard-2426390-34712722.jpg', prompt: 'studio.exampleBackgroundPrompts.027' },
  { url: 'https://r2.fashion-rec.com/example/pexels-jonathan-yakubu-337910510-28041981.jpg', prompt: 'studio.exampleBackgroundPrompts.028' },
  { url: 'https://r2.fashion-rec.com/example/pexels-laura-paredis-1047081-27041249.jpg', prompt: 'studio.exampleBackgroundPrompts.029' },
  { url: 'https://r2.fashion-rec.com/example/pexels-maksim-smirnov-27565989-32315717.jpg', prompt: 'studio.exampleBackgroundPrompts.030' },
  { url: 'https://r2.fashion-rec.com/example/pexels-maurits-bausenhart-1112663191-34865450.jpg', prompt: 'studio.exampleBackgroundPrompts.031' },
  { url: 'https://r2.fashion-rec.com/example/pexels-myfoodie-2551794.jpg', prompt: 'studio.exampleBackgroundPrompts.032' },
  { url: 'https://r2.fashion-rec.com/example/pexels-nilsr-28271725.jpg', prompt: 'studio.exampleBackgroundPrompts.033' },
  { url: 'https://r2.fashion-rec.com/example/pexels-ramon-clemente-1097299-34314485.jpg', prompt: 'studio.exampleBackgroundPrompts.034' },
  { url: 'https://r2.fashion-rec.com/example/pexels-ricky-kwong-113005840-35360579.jpg', prompt: 'studio.exampleBackgroundPrompts.035' },
  { url: 'https://r2.fashion-rec.com/example/pexels-simon73-30560968.jpg', prompt: 'studio.exampleBackgroundPrompts.036' },
  { url: 'https://r2.fashion-rec.com/example/pexels-studio-lichtfang-2152913672-32488229.jpg', prompt: 'studio.exampleBackgroundPrompts.037' },
  { url: 'https://r2.fashion-rec.com/example/pexels-tatilimiz-villada-2156582649-35141528.jpg', prompt: 'studio.exampleBackgroundPrompts.038' },
  { url: 'https://r2.fashion-rec.com/example/pexels-tobias-schwenk-2158345167-35319435.jpg', prompt: 'studio.exampleBackgroundPrompts.039' },
  { url: 'https://r2.fashion-rec.com/example/pexels-took-a-snap-789265640-20751943.jpg', prompt: 'studio.exampleBackgroundPrompts.040' },
  { url: 'https://r2.fashion-rec.com/example/pexels-urtimud-89-76108288-35117015.jpg', prompt: 'studio.exampleBackgroundPrompts.041' },
  { url: 'https://r2.fashion-rec.com/example/pexels-vahestnatukewild-34774915.jpg', prompt: 'studio.exampleBackgroundPrompts.042' },
  { url: 'https://r2.fashion-rec.com/example/pexels-valentin_21-808934417-31148513.jpg', prompt: 'studio.exampleBackgroundPrompts.043' },
  { url: 'https://r2.fashion-rec.com/example/pexels-wael-belkahla-2158256982-35329797.jpg', prompt: 'studio.exampleBackgroundPrompts.044' },
]
