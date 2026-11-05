import type { PracticeKind } from "./practice";

export interface ChoiceQuiz {
  kind: "choice";
  question: string;
  options: { id: string; label: string }[];
  correctId: string;
  correct: string;
  incorrect: string;
}

export interface PitchQuiz {
  kind: "pitch";
  question: string;
}

export interface SideQuiz {
  kind: "side";
  question: string;
}

export interface TutorialStep {
  id: string;
  title: string;
  paragraphs: string[];
  practice?: {
    kind: PracticeKind;
    instruction: string;
    success: string;
    optional?: boolean;
  };
  quiz?: ChoiceQuiz | PitchQuiz | SideQuiz;
  /** Place the listener somewhere known when the step opens. */
  setup?: {
    graphId: string;
    nodeId: string;
    announcement: string;
  };
}

export const tutorialSteps: TutorialStep[] = [
  {
    id: "move",
    title: "How to move without a mouse",
    paragraphs: [
      "This whole tool works from the keyboard. You do not need a mouse, and you do not need to find a picture.",
      "Tab moves to the next control. Shift+Tab moves to the previous control. Enter or Space activates the control you are on. Escape stops sound. If a help dialog is open, Escape closes that dialog instead.",
      "Your screen reader’s heading command is the fastest way around. The headings are Sound, Tutorial, Current graph, Where you are, Graph explorer, All nodes, Connections, Path you walked, and Settings.",
      "Skip links are first when you load the page. They are named Skip to sound, Skip to tutorial, Skip to graph explorer, Skip to all nodes, and Skip to help.",
      "Letter keys do nothing while you are on ordinary buttons. That is deliberate, so they do not steal your screen reader’s browse keys. Letter keys work only after you move into the graph explorer.",
      "This tutorial stays open while you try things. It does not trap your focus. Next step is always available, even if a practice is unfinished, so a missed key cannot lock you here.",
      "All steps sits under this tutorial as a collapsed control. Press Enter on it only if you want to jump to a different step. Back step and Next step are enough to move in order.",
    ],
    quiz: {
      kind: "choice",
      question: "Which key moves to the next control on this page?",
      options: [
        { id: "tab", label: "Tab" },
        { id: "escape", label: "Escape" },
        { id: "h", label: "The letter H" },
      ],
      correctId: "tab",
      correct: "Correct. Tab moves forward. Shift+Tab moves backward. Escape stops sound, and the letter H is left for your screen reader.",
      incorrect:
        "Not quite. Tab moves to the next control. Escape stops sound or closes the help dialog. Single letters are not page navigation, so your screen reader can keep using them.",
    },
  },
  {
    id: "sound",
    title: "Turn sound on",
    paragraphs: [
      "Browsers block musical notes until you ask for them. Under the heading Sound, activate the button named Enable sound. You should hear one short note in both ears.",
      "If you hear nothing, check the device volume, then check that the Tone volume slider is not at zero. The slider works with Left and Right Arrow once it has focus. Inside the graph explorer, the left bracket key makes tones quieter and the right bracket key makes them louder.",
      "Enabling sound once is enough for this visit. The button then becomes Replay test tone. Use it any time you want to confirm that tones still work.",
      "If this browser cannot start audio, every list and announcement still works. The page will say so, and it will not keep retrying in silence.",
    ],
    practice: {
      kind: "sound-enabled",
      instruction: "Activate Enable sound, or Replay test tone if sound is already on.",
      success: "Sound is on. The test note is the page’s way of saying the audio engine started.",
    },
  },
  {
    id: "two-audio",
    title: "Speech and tones are different",
    paragraphs: [
      "You will hear two kinds of audio, and they are meant to stay out of each other’s way.",
      "Speech comes from your screen reader. It reads headings, buttons, and the announcements this page sends. This page does not speak with its own voice unless you turn that on.",
      "Tones come from this tool. A steady note is a node. A glide from one pitch to another is a connection. Two short low pulses mean that move is not available. Tones are not words, so they can play while your screen reader talks.",
      "Mute tones turns the music off and leaves your screen reader alone. Use it if the notes make listening harder. Turn it back on when you want pitch again.",
      "In Settings, the checkbox Also speak announcements with the browser voice is off on purpose. Turn it on only if you do not use a screen reader. With a screen reader it talks over the speech you already hear.",
    ],
    practice: {
      kind: "mute-toggled",
      instruction: "Activate Mute tones once. Activate it again if you want the notes back before you continue.",
      success: "Mute works. Tones and screen-reader speech are separate.",
    },
  },
  {
    id: "what-graph",
    title: "What a graph is",
    paragraphs: [
      "A graph here is a set of places, called nodes, and the links between them, called connections. It is not a line chart, and there is nothing you have to see.",
      "The neighborhood graph is the practice map. Home connects to Bus Stop and Store. Bus Stop also connects to Library and Park. Store also connects to Park. You can travel only along a connection. Home does not connect directly to Library.",
      "Notice Board is present and has no connections. You can jump to it from the list of all nodes. Direction keys and Next connection cannot reach it from Home, and that is correct, not a broken key.",
      "Every node has a number. On this map the number is how busy the place is, from 1 to 10. The Current graph heading repeats this in words whenever you change graphs.",
      "A drawing of the same nodes is on the page for people who can see. It is hidden from screen readers. The lists and the Where you are heading are the real interface.",
    ],
    quiz: {
      kind: "choice",
      question: "In the neighborhood graph, which places does Home connect to?",
      options: [
        { id: "none", label: "No places" },
        { id: "two", label: "Two places: Bus Stop and Store" },
        { id: "five", label: "Every other place" },
      ],
      correctId: "two",
      correct: "Correct. Home has two connections, Bus Stop and Store. Library is reached through Bus Stop, not from Home directly.",
      incorrect:
        "Home connects to two places: Bus Stop and Store. Notice Board is on the map but it connects to nobody. Library is one more step, through Bus Stop.",
    },
  },
  {
    id: "pitch",
    title: "Pitch means the value",
    paragraphs: [
      "A small value is a low note. A large value is a high note. The notes use a pentatonic scale, the black-key pattern on a piano, so two neighboring values are easier to tell apart than if every tiny step were used.",
      "Very close values can share a pitch. The spoken value is always exact. Trust the number when two notes sound alike.",
      "The start node of a graph adds a soft higher chime on top of its note, so you can recognize the start by timbre as well as by name.",
      "A node with more connections holds its note a little longer. A node with no connections is the shortest note.",
      "Headphones are not required for pitch. Left and right placement comes later and is optional.",
    ],
    practice: {
      kind: "summary",
      instruction:
        "Move to the button Announce where you are and activate it. You will hear the current name, value, and connections through your screen reader.",
      success: "That summary is always available. It does not depend on hearing the pitch.",
    },
    quiz: {
      kind: "pitch",
      question: "Play the two notes, then say which one was higher. They are not graph nodes. They only train the pitch scale.",
    },
  },
  {
    id: "where",
    title: "Read where you are",
    paragraphs: [
      "Under Where you are, the page keeps a sentence for the current node: its name, its value, whether that value is low or high for this graph, and the names of its connections. It is ordinary text, so you can read it again with your screen reader whenever you want. It does not shout on every move.",
      "Moves also send a short announcement. If an announcement arrives while you are still reading, your screen reader may speak the newest one and drop the older one. Activate Announce where you are to hear the full sentence again.",
      "Verbosity is in Settings. Short speaks the name and the count. Standard adds the value and whether a trip went up or down. Detailed adds what the number means and where the node sits in the layout, such as toward the left and toward the bottom. Standard is the default.",
      "Layout words describe the same positions used for direction keys. You do not have to picture them.",
    ],
  },
  {
    id: "travel",
    title: "Travel a connection",
    paragraphs: [
      "There are three ways to travel, and they all follow real connections. Jumping from the All nodes list is different: a jump can skip links, and the announcement says so.",
      "First way: the button Next connection. It walks the connections of the current node in name order. From Home, the names are Bus Stop, then Store, so the first press goes to Bus Stop. The next press uses Bus Stop’s own list. It does not keep you cycling Home’s list after you have left.",
      "Previous connection walks that same list backward. If you go past the end, the announcement says the connection list is starting again.",
      "Second way: focus the graph explorer and press Down Arrow or Up Arrow. Those keys do the same thing as the two buttons. Left Arrow, or the Step back button, returns along the path you actually walked. After you step back to a place with several connections, the next connection continues past the place you just left, so you do not immediately undo that return. Before you have walked anywhere, the first connection is still the first name.",
      "Third way: the Connections list. Down Arrow moves through the links without traveling. Enter or Space travels to the highlighted one. Each item says whether the value is higher, lower, or the same.",
      "When you travel, you hear a glide. The pitch slides from the place you left to the place you arrived. An upward glide means the value increased. A downward glide means it decreased. Two equal taps mean the value did not change.",
      "If a node has only one connection, the tool takes it and says so. If it has none, you hear two low pulses and you stay put.",
    ],
    setup: {
      graphId: "neighborhood",
      nodeId: "home",
      announcement: "For this exercise you are at Home on Neighborhood errands.",
    },
    practice: {
      kind: "travel-home-bus",
      instruction:
        "From Home, activate Next connection, or focus the graph explorer and press Down Arrow. Either one travels to Bus Stop. Enter on Bus Stop in the Connections list also counts.",
      success: "You traveled from Home to Bus Stop along a real connection. The glide moved from Home’s lower note to Bus Stop’s higher note.",
    },
  },
  {
    id: "direction",
    title: "Direction keys",
    paragraphs: [
      "Direction is a second way to choose a connection. It uses the layout, not the alphabetical name.",
      "From Home, Store is toward the right. Bus Stop is toward the up side. Left and down have nobody.",
      "Activate Direction right, or focus the graph explorer and press Shift+Right Arrow. Shift matters. Plain Right Arrow does not travel. It stays put and reminds you of the Shift key, so a stray press cannot walk you somewhere you did not choose.",
      "Plain Left Arrow steps back along your walk. Shift+Left Arrow looks for a connection toward the left. Those are different on purpose.",
      "If two nodes sit in almost the same direction, the tool picks the closer angle and names the other one.",
      "If you are not using the layout, skip this practice. Next connection and the Connections list cover every link.",
    ],
    setup: {
      graphId: "neighborhood",
      nodeId: "home",
      announcement: "For this exercise you are back at Home. The walk history was cleared.",
    },
    practice: {
      kind: "direction-home-store",
      optional: true,
      instruction:
        "Optional. From Home, activate Direction right, or press Shift+Right Arrow in the graph explorer. That travels to Store. Then use Step back if you want to return.",
      success: "Direction right followed the connection from Home to Store. The glide should have risen, because Store is busier than Home.",
    },
  },
  {
    id: "ears",
    title: "Left and right ears",
    paragraphs: [
      "With headphones, a node toward the left of the layout sounds mostly in the left ear, and a node toward the right sounds mostly in the right ear. The pan never goes fully to one side, so the note is still audible if one ear is weaker.",
      "Speakers make this difference small. One headphone is not enough to judge it. The spoken name does not depend on it.",
      "Pitch, the glide, and the lists stay the same if you skip this step.",
    ],
    quiz: {
      kind: "side",
      question:
        "Play the panned note and say which ear it favored. If you are on speakers, or you are not sure, choose the option that says you are skipping the ear test.",
    },
  },
  {
    id: "playback",
    title: "Play the whole graph",
    paragraphs: [
      "Play the whole graph sounds every node in an order that matches the data. A chain, such as the week of temperatures, plays from the first day to the last. A prerequisite graph plays in an order that respects the arrows. Anything else plays from the start node outward, nearby nodes first, and then names nodes that cannot be reached.",
      "Before the notes, an announcement describes that order. Escape stops the notes and leaves you where you are. The same button becomes Stop playback while it is running.",
      "In Settings, Announce each node during playback sends a name and value before every note. It is off by default so the tones are not buried under speech. Turn it on if you want a guided tour. The gap between notes is longer when that setting is on.",
      "Arrow keys and the travel buttons cancel playback and do the move you asked for. You will hear Playback stopped, then the result of the move.",
    ],
    practice: {
      kind: "playback-cycle",
      instruction:
        "Activate Play the whole graph. After you hear the order announced, activate Stop playback or press Escape. Letting it finish also counts.",
      success: "Playback can be started and stopped. Escape is the emergency stop for sound.",
    },
  },
  {
    id: "change",
    title: "Change graphs",
    paragraphs: [
      "The Graph select is under Current graph. It is a normal select: Tab to it, Up and Down Arrow to move, Enter or just leaving it on the new item confirms, depending on your browser. The page announces the new description and places you on that graph’s start node.",
      "Four graphs are built in. Neighborhood errands is the practice map. Week of temperatures is a chain. Course prerequisites uses arrows. Team communication is a small social graph with Maya at the center.",
      "Inside the graph explorer, the number keys 1 through 4 switch graphs in that same order. They do nothing on buttons and in the search field.",
      "Changing graphs clears the walk history. It does not clear this tutorial.",
    ],
    practice: {
      kind: "graph-changed",
      instruction:
        "Choose any graph other than Neighborhood errands. You can return with the same select. The neighborhood map is item 1.",
      success: "The graph changed, and the announcement included what the numbers mean.",
    },
  },
  {
    id: "trouble",
    title: "When something goes wrong",
    paragraphs: [
      "No tones: move to Sound and activate Enable sound, then Replay test tone. Confirm Tone volume is above zero and Mute tones is not on. Replay tone says so if sound is off, muted, or at zero. Play the whole graph turns sound on. If tones are muted or the volume is zero, playback refuses to start and says why. If the browser blocked audio, the announcement says the lists still work.",
      "Sound will not stop: press Escape. Escape always stops tones and browser speech. If the help dialog is open, the first Escape closes the dialog and the next Escape stops sound. Escape does not close this tutorial, so you cannot lose your place by silencing a note.",
      "A key seems dead: you may be in the filter field, or a dialog may be open. Escape clears a filter when focus is in that field. Tab away, then try the button with the same name as the key. Every explorer key has a button.",
      "Your screen reader’s browse keys stopped working: focus is probably inside the graph explorer, which is an application region. Arrow keys there move through the graph. Press Escape to leave it. Focus moves to the node list, and browse keys work again. Tab also leaves.",
      "Holding an arrow floods you with notes: the explorer ignores key repeat. Press once for each move.",
      "You are lost: activate Announce where you are, or read the Where you are heading. Jump to start returns to the graph’s start node and says that the move is a jump.",
      "The current node vanished from All nodes: the filter is hiding it. Escape in the filter, or Clear filter. The explorer still uses the hidden node until you jump.",
      "Two voices at once: turn off Also speak announcements with the browser voice.",
      "You slid off a connection you did not want: Step back walks the history, including jumps. The announcement says whether that step was a real connection.",
      "Settings and the tutorial step are stored in this browser. If storage is blocked, they last for this visit only. Nothing is sent to a server.",
    ],
    practice: {
      kind: "volume-changed",
      instruction:
        "Change Tone volume with the slider, or focus the graph explorer and press the left or right bracket key.",
      success: "Volume responds. The percent is part of the slider’s value.",
    },
    quiz: {
      kind: "choice",
      question: "Tones will not stop. What do you press first?",
      options: [
        { id: "escape", label: "Escape" },
        { id: "q", label: "The letter Q" },
        { id: "close", label: "Close the browser tab" },
      ],
      correctId: "escape",
      correct:
        "Correct. Escape stops every tone. If help is open, Escape closes help first. Press it again for the sound. Closing the tab is not required.",
      incorrect:
        "Press Escape first. It stops tones. If a help dialog is open, Escape closes that dialog, then the next Escape stops sound. The letter Q does nothing. You do not need to close the tab.",
    },
  },
  {
    id: "ready",
    title: "You can explore",
    paragraphs: [
      "You have the whole map of the tool. Tab and headings move between sections. Enter activates. Escape stops sound or leaves the graph explorer.",
      "Next connection, Previous connection, and the Connections list follow real links. All nodes can jump, and a jump tells you that it skipped links. Shift plus an arrow, or the Direction buttons, use the layout.",
      "Pitch is the value. An upward glide means the number went up. Two low pulses mean you cannot go that way. Mute tones leaves your screen reader speaking.",
      "Open tutorial brings these steps back, on the step you left. Finish keeps the step saved and moves you to the graph explorer.",
      "Suggested first free walk: on Neighborhood errands, travel Home, Bus Stop, Library, then Step back until you return. Then try Week of temperatures and listen for the rise into Thursday and the fall toward Sunday.",
    ],
  },
];

export function tutorialStepCount(): number {
  return tutorialSteps.length;
}

export function clampStep(index: number): number {
  if (!Number.isFinite(index)) return 0;
  return Math.min(tutorialSteps.length - 1, Math.max(0, Math.floor(index)));
}
