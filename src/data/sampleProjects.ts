import { ProjectData } from '../types';

export const SAMPLE_PROJECTS: ProjectData[] = [
  {
    id: 'grindhouse-double-feature',
    title: 'Grindhouse Double Feature (1977-1981) - Multi-Film Master Tape',
    director: 'Kazuo Mori & Vince Thorne',
    genres: ['Action', 'Sci-Fi', 'Chanbara', 'Tech-Noir', 'Grindhouse'],
    releaseYear: 1977,
    audioFileName: 'grindhouse_marathon_master_tape.wav',
    videoSource: {
      fileName: 'zoom_webcam_grindhouse_720p25.mp4',
      fileType: 'video/mp4',
      width: 1280,
      height: 720,
      fps: 25,
      isZoomWebcam: true,
      isSimulated: true,
    },
    filmDurationSec: 1105, // Combined synced duration for reference
    frameRate: 23.976,
    isMultiFilm: true,
    activeFilmId: 'film-1',
    films: [
      {
        id: 'film-1',
        sequenceIndex: 1,
        title: 'Laser Samurai (1977)',
        director: 'Kazuo Mori',
        genres: ['Action', 'Sci-Fi', 'Chanbara', 'Martial Arts'],
        releaseYear: 1977,
        discLabel: 'Disc 1 / Feature 1',
        filmDurationSec: 470, // 7m 50s synced runtime
        frameRate: 23.976,
        rawRange: {
          startSec: 0,
          endSec: 570, // 9m 30s in master audio
        },
        intermissionBeforeSec: 0,
        intermissionNote: 'Start of master recording tape',
        initialSync: {
          commentaryStartSec: 14.0,
          filmStartSec: 0.0,
          cuePhrase: 'Three, two, one, press play on the Toho scope logo!',
          preRollAction: 'Trim 14.0s marathon intro chatter',
        },
        pauseEvents: [
          {
            id: 'film1-pause-1',
            commentaryPauseStartSec: 175.0,
            commentaryResumeSec: 217.0,
            durationCutSec: 42.0,
            filmTimestampSec: 161.0,
            triggerPhrase: 'Hit pause right here! Look closely at the swordsman\'s stunt wig flying off!',
            resumePhrase: 'Haha classic practical effects! Unpausing in three, two, one, resume.',
            confidence: 'high',
            reason: 'Stunt wig wardrobe malfunction freeze frame',
            enabled: true,
            crossfadeMs: 20,
            filmId: 'film-1',
          },
          {
            id: 'film1-pause-2',
            commentaryPauseStartSec: 360.0,
            commentaryResumeSec: 404.0,
            durationCutSec: 44.0,
            filmTimestampSec: 304.0,
            triggerPhrase: 'Wait, wait, don\'t— stop! Hold on, freeze it, my headphone cord snagged on the armrest!',
            resumePhrase: 'No, wait, 3, 2— ah hold on, what second are we on? Okay: 3, 2, 1, play!',
            confidence: 'low',
            confidenceScore: 36,
            ambiguityType: 'chaotic_start_stop',
            contextualWarning: 'Speaker halted abruptly mid-sentence ("don\'t— stop!") and stuttered during resume countdown ("3, 2— ah hold on..."). High risk of clipped consonants at cut-in. +40ms pre-roll padding recommended.',
            isUserVerified: false,
            reason: 'Chaotic stop & restart with headphone cord snag',
            enabled: true,
            crossfadeMs: 20,
            filmId: 'film-1',
          },
        ],
        anchorPoints: [
          {
            id: 'film1-anchor-1',
            commentarySec: 38.0,
            filmSec: 24.0,
            label: 'Opening gold title fanfare: "LASER SAMURAI"',
            type: 'title_card',
            driftMs: 0,
            filmId: 'film-1',
          },
          {
            id: 'film1-anchor-2',
            commentarySec: 140.0,
            filmSec: 126.0,
            label: 'Alleyway confrontation: "Draw your plasma blade, traitor!"',
            type: 'dialogue_match',
            driftMs: 8,
            filmId: 'film-1',
          },
          {
            id: 'film1-anchor-3',
            commentarySec: 460.0,
            filmSec: 360.0,
            label: 'Rooftop laser duel in rainstorm',
            type: 'visual_cue',
            driftMs: -4,
            filmId: 'film-1',
          },
        ],
        segmentsToKeep: [
          {
            segmentIndex: 1,
            rawCommentaryStartSec: 14.0,
            rawCommentaryEndSec: 175.0,
            targetFilmStartSec: 0.0,
            targetFilmEndSec: 161.0,
            durationSec: 161.0,
            notes: 'Feature 1 Act I: Title crawl through alleyway encounter',
            filmId: 'film-1',
          },
          {
            segmentIndex: 2,
            rawCommentaryStartSec: 217.0,
            rawCommentaryEndSec: 360.0,
            targetFilmStartSec: 161.0,
            targetFilmEndSec: 304.0,
            durationSec: 143.0,
            notes: 'Feature 1 Act II: Dojo infiltration sequence',
            filmId: 'film-1',
          },
          {
            segmentIndex: 3,
            rawCommentaryStartSec: 404.0,
            rawCommentaryEndSec: 570.0,
            targetFilmStartSec: 304.0,
            targetFilmEndSec: 470.0,
            durationSec: 166.0,
            notes: 'Feature 1 Act III: Climax and end credits',
            filmId: 'film-1',
          },
        ],
        summary: {
          totalRawDurationSec: 570.0,
          totalCutSec: 100.0, // 14s pre-roll + 42s pause1 + 44s pause2 = 100s
          finalSyncedDurationSec: 470.0,
          pauseCount: 2,
          conformityStatus: 'in-sync',
          engineerNotes: 'Feature 1 conformed for Disc 1 (23.976 fps). Both stunt and headphone pauses excised with 20ms linear crossfade.',
        },
        commentaryTranscript: `[00:00:02] Host: Welcome to the Midnight Grindhouse double-feature marathon audio commentary!
[00:00:06] Co-host: Two films tonight: Laser Samurai (1977) followed by Cyber Stalker (1981).
[00:00:10] Host: Alright everyone, load up Disc 1. Three, two, one, press play on the Toho scope logo!
[00:00:15] Co-host: And we are underway! Look at that 35mm grain structure on the 4K scan.
[00:02:55] Host: Hit pause right here! Look closely at the swordsman's stunt wig flying off!
[00:03:10] Co-host: Oh man, during the 180-degree spin kick! You can see the tape on his forehead!
[00:03:35] Host: Haha classic practical effects! Unpausing in three, two, one, resume.
[00:03:38] Co-host: Back in action. Here comes the shogun's cybernetic bodyguard.
[00:06:00] Host: Hold on, freeze the picture, my headphone cord snagged on the armrest.
[00:06:20] Co-host: Taking a quick breather while you fix that. Notice the anamorphic lens flares.
[00:06:42] Host: Okay untangled and re-seated. Let us get back in: 3, 2, 1, play!
[00:06:45] Co-host: Perfect, onto the final pagoda showdown.`,
        filmDialogueOrCues: `00:00:00.000 --> 00:00:14.000
[Toho Scope & CinemaScope Golden Logo]

00:00:24.000 --> 00:00:36.000
Tokyo, 2077. The Neon Shogunate rules with an iron blade.

00:02:06.000 --> 00:02:16.000
Kenji: "Draw your plasma blade, traitor!"
Ren: "My blade answers only to the Emperor."

00:06:00.000 --> 00:06:15.000
[Pagoda thunderstorm rooftop duel - thunder cracks]`,
      },
      {
        id: 'film-2',
        sequenceIndex: 2,
        title: 'Cyber Stalker (1981)',
        director: 'Vince Thorne',
        genres: ['Tech-Noir', 'Thriller', 'Cyberpunk', 'Crime'],
        releaseYear: 1981,
        discLabel: 'Disc 2 / Feature 2',
        filmDurationSec: 650, // 10m 50s
        frameRate: 24,
        rawRange: {
          startSec: 675, // 11m 15s in master audio (after 105s intermission)
          endSec: 1425,  // 23m 45s in master audio
        },
        intermissionBeforeSec: 105,
        intermissionNote: '105s Intermission: Disc swap banter, popcorn break, vintage trailer chat',
        initialSync: {
          commentaryStartSec: 690.0, // 15s count-in into Film 2
          filmStartSec: 0.0,
          cuePhrase: 'Alright Disc 2 is loaded! 3, 2, 1, hit play on the studio shield!',
          preRollAction: 'Trim 15.0s Film 2 countdown banter',
        },
        pauseEvents: [
          {
            id: 'film2-pause-1',
            commentaryPauseStartSec: 880.0,
            commentaryResumeSec: 932.0,
            durationCutSec: 52.0,
            filmTimestampSec: 190.0,
            triggerPhrase: 'Wait, stop the movie for a second! Check out the vintage Apple II monitor on the desk!',
            resumePhrase: 'Right on! Unpausing in three, two, one, resume playback!',
            confidence: 'medium',
            confidenceScore: 62,
            ambiguityType: 'mid_sentence_cut',
            contextualWarning: 'Speaker interjected during film dialogue. Verify speech cut boundary with audition to prevent score clipping.',
            isUserVerified: false,
            reason: 'Computer prop retro-hardware discussion freeze frame',
            enabled: true,
            crossfadeMs: 25,
            filmId: 'film-2',
          },
          {
            id: 'film2-pause-2',
            commentaryPauseStartSec: 1140.0,
            commentaryResumeSec: 1188.0,
            durationCutSec: 48.0,
            filmTimestampSec: 398.0,
            triggerPhrase: 'Hold up, pause right here, delivery guy is ringing the intercom.',
            resumePhrase: 'Pizza secured! Ready to roll: 3, 2, 1, unpause!',
            confidence: 'high',
            reason: 'Food delivery intercom interruption',
            enabled: true,
            crossfadeMs: 25,
            filmId: 'film-2',
          },
        ],
        anchorPoints: [
          {
            id: 'film2-anchor-1',
            commentarySec: 715.0,
            filmSec: 25.0,
            label: 'Helicopter sweeping over night skyline with analog synth drone',
            type: 'visual_cue',
            driftMs: 0,
            filmId: 'film-2',
          },
          {
            id: 'film2-anchor-2',
            commentarySec: 820.0,
            filmSec: 130.0,
            label: 'Mainframe terminal login: "Access Granted - Sector 4"',
            type: 'dialogue_match',
            driftMs: 6,
            filmId: 'film-2',
          },
          {
            id: 'film2-anchor-3',
            commentarySec: 1260.0,
            filmSec: 455.0,
            label: 'Server room shootout climax',
            type: 'visual_cue',
            driftMs: -6,
            filmId: 'film-2',
          },
        ],
        segmentsToKeep: [
          {
            segmentIndex: 1,
            rawCommentaryStartSec: 690.0,
            rawCommentaryEndSec: 880.0,
            targetFilmStartSec: 0.0,
            targetFilmEndSec: 190.0,
            durationSec: 190.0,
            notes: 'Feature 2 Act I: Disc 2 opening credits through laboratory intro',
            filmId: 'film-2',
          },
          {
            segmentIndex: 2,
            rawCommentaryStartSec: 932.0,
            rawCommentaryEndSec: 1140.0,
            targetFilmStartSec: 190.0,
            targetFilmEndSec: 398.0,
            durationSec: 208.0,
            notes: 'Feature 2 Act II: Police investigation & data theft',
            filmId: 'film-2',
          },
          {
            segmentIndex: 3,
            rawCommentaryStartSec: 1188.0,
            rawCommentaryEndSec: 1425.0,
            targetFilmStartSec: 398.0,
            targetFilmEndSec: 635.0,
            durationSec: 237.0,
            notes: 'Feature 2 Act III: Server facility shootout & credits',
            filmId: 'film-2',
          },
        ],
        summary: {
          totalRawDurationSec: 750.0,
          totalCutSec: 115.0, // 15s pre-roll + 52s pause1 + 48s pause2 = 115s
          finalSyncedDurationSec: 635.0,
          pauseCount: 2,
          conformityStatus: 'in-sync',
          engineerNotes: 'Feature 2 conformed for Disc 2 (24.0 fps). Ready for authoring to Disc 2 M2TS stream.',
        },
        commentaryTranscript: `[00:09:30] Host: And that wraps up Laser Samurai! What a wild 1977 gem.
[00:09:40] Co-host: Let us take a 2-minute intermission to swap discs in the player and grab drinks.
[00:10:20] Host: Swapping to Disc 2: Cyber Stalker (1981). Directed by the second-unit maestro.
[00:11:15] Host: Alright Disc 2 is loaded! 3, 2, 1, hit play on the studio shield!
[00:11:20] Co-host: Synth bassline kicks right in. Love the Tangerine Dream vibes here.
[00:14:40] Host: Wait, stop the movie for a second! Check out the vintage Apple II monitor on the desk!
[00:15:00] Co-host: That green phosphor screen! You can see the actual disk drive spinning.
[00:15:30] Host: Right on! Unpausing in three, two, one, resume playback!
[00:19:00] Host: Hold up, pause right here, delivery guy is ringing the intercom.
[00:19:25] Co-host: Excellent, grab the food, I will keep eyes on the film's lighting design.
[00:19:46] Host: Pizza secured! Ready to roll: 3, 2, 1, unpause!
[00:19:50] Co-host: Back into the neon corridor!`,
        filmDialogueOrCues: `00:00:00.000 --> 00:00:12.000
[Orion Pictures Silver Shield]

00:00:25.000 --> 00:00:40.000
[Night skyline aerial drone - helicopter blades whirring]

00:02:10.000 --> 00:02:22.000
Operator: "Access Granted - Sector 4 mainframe unlocked."

00:07:35.000 --> 00:07:50.000
Detective Thorne: "He's not a hacker, he's inside the building!"`,
      },
    ],
    // Flat top-level fallbacks reflecting Film 1 for full backward compatibility:
    initialSync: {
      commentaryStartSec: 14.0,
      filmStartSec: 0.0,
      cuePhrase: 'Three, two, one, press play on the Toho scope logo!',
      preRollAction: 'Trim 14.0s marathon intro chatter',
    },
    pauseEvents: [
      {
        id: 'film1-pause-1',
        commentaryPauseStartSec: 175.0,
        commentaryResumeSec: 217.0,
        durationCutSec: 42.0,
        filmTimestampSec: 161.0,
        triggerPhrase: 'Hit pause right here! Look closely at the swordsman\'s stunt wig flying off!',
        resumePhrase: 'Haha classic practical effects! Unpausing in three, two, one, resume.',
        confidence: 'high',
        reason: 'Stunt wig wardrobe malfunction freeze frame',
        enabled: true,
        crossfadeMs: 20,
        filmId: 'film-1',
      },
      {
        id: 'film1-pause-2',
        commentaryPauseStartSec: 360.0,
        commentaryResumeSec: 404.0,
        durationCutSec: 44.0,
        filmTimestampSec: 304.0,
        triggerPhrase: 'Wait, wait, don\'t— stop! Hold on, freeze it, my headphone cord snagged on the armrest!',
        resumePhrase: 'No, wait, 3, 2— ah hold on, what second are we on? Okay: 3, 2, 1, play!',
        confidence: 'low',
        confidenceScore: 36,
        ambiguityType: 'chaotic_start_stop',
        contextualWarning: 'Speaker halted abruptly mid-sentence ("don\'t— stop!") and stuttered during resume countdown ("3, 2— ah hold on..."). High risk of clipped consonants at cut-in. +40ms pre-roll padding recommended.',
        isUserVerified: false,
        reason: 'Chaotic stop & restart with headphone cord snag',
        enabled: true,
        crossfadeMs: 20,
        filmId: 'film-1',
      },
    ],
    anchorPoints: [
      {
        id: 'film1-anchor-1',
        commentarySec: 38.0,
        filmSec: 24.0,
        label: 'Opening gold title fanfare: "LASER SAMURAI"',
        type: 'title_card',
        driftMs: 0,
        filmId: 'film-1',
      },
      {
        id: 'film1-anchor-2',
        commentarySec: 140.0,
        filmSec: 126.0,
        label: 'Alleyway confrontation: "Draw your plasma blade, traitor!"',
        type: 'dialogue_match',
        driftMs: 8,
        filmId: 'film-1',
      },
      {
        id: 'film1-anchor-3',
        commentarySec: 460.0,
        filmSec: 360.0,
        label: 'Rooftop laser duel in rainstorm',
        type: 'visual_cue',
        driftMs: -4,
        filmId: 'film-1',
      },
    ],
    segmentsToKeep: [
      {
        segmentIndex: 1,
        rawCommentaryStartSec: 14.0,
        rawCommentaryEndSec: 175.0,
        targetFilmStartSec: 0.0,
        targetFilmEndSec: 161.0,
        durationSec: 161.0,
        notes: 'Feature 1 Act I: Title crawl through alleyway encounter',
      },
      {
        segmentIndex: 2,
        rawCommentaryStartSec: 217.0,
        rawCommentaryEndSec: 360.0,
        targetFilmStartSec: 161.0,
        targetFilmEndSec: 304.0,
        durationSec: 143.0,
        notes: 'Feature 1 Act II: Dojo infiltration sequence',
      },
      {
        segmentIndex: 3,
        rawCommentaryStartSec: 404.0,
        rawCommentaryEndSec: 570.0,
        targetFilmStartSec: 304.0,
        targetFilmEndSec: 470.0,
        durationSec: 166.0,
        notes: 'Feature 1 Act III: Climax and end credits',
      },
    ],
    summary: {
      totalRawDurationSec: 1425.0, // Full master audio file length
      totalCutSec: 215.0,
      finalSyncedDurationSec: 1105.0,
      pauseCount: 4,
      conformityStatus: 'in-sync',
      engineerNotes: 'Sequential 2-Film Master Recording. Film 1 (Laser Samurai, 0-9m30s) + Intermission (9m30s-11m15s) + Film 2 (Cyber Stalker, 11m15s-23m45s).',
    },
    commentaryTranscript: `[00:00:02] Host: Welcome to the Midnight Grindhouse double-feature marathon audio commentary!
[00:00:06] Co-host: Two films tonight: Laser Samurai (1977) followed by Cyber Stalker (1981).
[00:00:10] Host: Alright everyone, load up Disc 1. Three, two, one, press play on the Toho scope logo!
[00:02:55] Host: Hit pause right here! Look closely at the swordsman's stunt wig flying off!
[00:03:35] Host: Haha classic practical effects! Unpausing in three, two, one, resume.
[00:06:00] Host: Hold on, freeze the picture, my headphone cord snagged on the armrest.
[00:06:42] Host: Okay untangled and re-seated. Let us get back in: 3, 2, 1, play!
[00:09:30] Host: And that wraps up Laser Samurai! What a wild 1977 gem.
[00:09:40] Co-host: Let us take a 2-minute intermission to swap discs in the player and grab drinks.
[00:11:15] Host: Alright Disc 2 is loaded! 3, 2, 1, hit play on the studio shield!
[00:14:40] Host: Wait, stop the movie for a second! Check out the vintage Apple II monitor on the desk!
[00:15:30] Host: Right on! Unpausing in three, two, one, resume playback!
[00:19:00] Host: Hold up, pause right here, delivery guy is ringing the intercom.
[00:19:46] Host: Pizza secured! Ready to roll: 3, 2, 1, unpause!`,
    filmDialogueOrCues: `00:00:00.000 --> 00:00:14.000
[Toho Scope & CinemaScope Golden Logo]

00:02:06.000 --> 00:02:16.000
Kenji: "Draw your plasma blade, traitor!"

00:11:15.000 --> 00:11:30.000
[Feature 2 - Orion Pictures Logo]

00:13:25.000 --> 00:13:40.000
Operator: "Access Granted - Sector 4 mainframe unlocked."`,
  },
  {
    id: 'scifi-odyssey-1982',
    title: 'Neon Nexus (1982) - Director & VFX Commentary',
    director: 'Ridley Vance',
    genres: ['Sci-Fi', 'Neo-Noir', 'Dystopian', 'Cyberpunk'],
    releaseYear: 1982,
    audioFileName: 'neon_nexus_director_commentary.wav',
    filmDurationSec: 580,
    frameRate: 23.976,
    isMultiFilm: false,
    initialSync: {
      commentaryStartSec: 14.0,
      filmStartSec: 0.0,
      cuePhrase: 'Three, two, one, press play on the studio logo!',
      preRollAction: 'Trim 14.0s count-in banter',
    },
    pauseEvents: [
      {
        id: 'pause-1',
        commentaryPauseStartSec: 192.0,
        commentaryResumeSec: 234.0,
        durationCutSec: 42.0,
        filmTimestampSec: 178.0,
        triggerPhrase: 'Wait, pause it right here! Look at the model wires above the police car!',
        resumePhrase: 'Haha classic 80s matte! Okay unpausing in 3, 2, 1, resume.',
        confidence: 'high',
        reason: 'Visual FX wire rig discussion while freezing frame',
        enabled: true,
        crossfadeMs: 20,
      },
      {
        id: 'pause-2',
        commentaryPauseStartSec: 410.0,
        commentaryResumeSec: 468.0,
        durationCutSec: 58.0,
        filmTimestampSec: 354.0,
        triggerPhrase: 'Hold on, hit pause for a sec, my tea kettle is whistling.',
        resumePhrase: 'Alright back, sorry about that! Let us get back into it: 3, 2, 1, play!',
        confidence: 'high',
        reason: 'Participant beverage interruption',
        enabled: true,
        crossfadeMs: 20,
      },
    ],
    anchorPoints: [
      {
        id: 'anchor-1',
        commentarySec: 45.0,
        filmSec: 31.0,
        label: 'Opening crawl titles & Vangelis synthesizer cue',
        type: 'title_card',
        driftMs: 0,
      },
      {
        id: 'anchor-2',
        commentarySec: 120.0,
        filmSec: 106.0,
        label: 'Detective enters interrogation room: "Where were you on the 14th?"',
        type: 'dialogue_match',
        driftMs: 12,
      },
      {
        id: 'anchor-3',
        commentarySec: 260.0,
        filmSec: 204.0,
        label: 'Explosion at the Tyrell pyramid tower balcony',
        type: 'visual_cue',
        driftMs: -8,
      },
      {
        id: 'anchor-4',
        commentarySec: 520.0,
        filmSec: 406.0,
        label: 'Replicant speech begins: "All those moments will be lost in time..."',
        type: 'dialogue_match',
        driftMs: 4,
      },
    ],
    segmentsToKeep: [
      {
        segmentIndex: 1,
        rawCommentaryStartSec: 14.0,
        rawCommentaryEndSec: 192.0,
        targetFilmStartSec: 0.0,
        targetFilmEndSec: 178.0,
        durationSec: 178.0,
        notes: 'Act I intro: Opening titles through interrogation room',
      },
      {
        segmentIndex: 2,
        rawCommentaryStartSec: 234.0,
        rawCommentaryEndSec: 410.0,
        targetFilmStartSec: 178.0,
        targetFilmEndSec: 354.0,
        durationSec: 176.0,
        notes: 'Act II: Spinner chase sequence through skyscraper district',
      },
      {
        segmentIndex: 3,
        rawCommentaryStartSec: 468.0,
        rawCommentaryEndSec: 694.0,
        targetFilmStartSec: 354.0,
        targetFilmEndSec: 580.0,
        durationSec: 226.0,
        notes: 'Act III: Climax and monologue to end credits',
      },
    ],
    summary: {
      totalRawDurationSec: 694.0,
      totalCutSec: 114.0,
      finalSyncedDurationSec: 580.0,
      pauseCount: 2,
      conformityStatus: 'in-sync',
      engineerNotes: 'Commentary track successfully conforms to 23.976 fps master. 2 freeze pauses excised with 20ms linear crossfade; 0 frame drift at key dialogue anchors.',
    },
    commentaryTranscript: `[00:00:02] Director: Hey everyone, welcome to the archival audio commentary for Neon Nexus.
[00:00:07] VFX Supervisor: Great to be here. We recorded this back during the anniversary screening.
[00:00:10] Director: Alright, cue up your Blu-ray discs. Three, two, one, press play on the studio logo!
[00:00:15] VFX Supervisor: And we are off! Look at that miniature model shot...
[00:03:12] VFX Supervisor: Wait, pause it right here! Look at the model wires above the police car!
[00:03:52] Director: Haha classic 80s matte! Okay unpausing in 3, 2, 1, resume.
[00:06:50] Director: Hold on, hit pause for a sec, my tea kettle is whistling.
[00:07:46] Director: Alright back, sorry about that! Let us get back into it: 3, 2, 1, play!`,
    filmDialogueOrCues: `00:00:00.000 --> 00:00:12.000
[Warner Bros. Studio Shield & 70mm Fanfare]

00:00:31.000 --> 00:00:44.000
Los Angeles, November 2019. The dawn of the 21st century.

00:01:46.000 --> 00:01:52.000
Detective: "Where were you on the 14th?"`,
  },
  {
    id: 'cyberpunk-reunion-1995',
    title: 'Ghost Algorithm (1995) - Fan Podcast & Historian Track',
    director: 'Mamoru Oshii',
    genres: ['Anime', 'Cyberpunk', 'Sci-Fi', 'Thriller'],
    releaseYear: 1995,
    audioFileName: 'ghost_algorithm_commentary.wav',
    filmDurationSec: 640,
    frameRate: 24,
    isMultiFilm: false,
    initialSync: {
      commentaryStartSec: 8.5,
      filmStartSec: 0.0,
      cuePhrase: 'Start disc at countdown mark: 3, 2, 1, GO!',
      preRollAction: 'Trim 8.5s podcast intro',
    },
    pauseEvents: [
      {
        id: 'pause-cyber-1',
        commentaryPauseStartSec: 145.0,
        commentaryResumeSec: 185.0,
        durationCutSec: 40.0,
        filmTimestampSec: 136.5,
        triggerPhrase: 'Stop the film right here! That kanji sign in the background is a mistranslation!',
        resumePhrase: 'Okay, let us keep moving. Unpause in three, two, one, hit it!',
        confidence: 'high',
        reason: 'Linguistic trivia dispute during background sign',
        enabled: true,
        crossfadeMs: 25,
      },
      {
        id: 'pause-cyber-2',
        commentaryPauseStartSec: 360.0,
        commentaryResumeSec: 415.0,
        durationCutSec: 55.0,
        filmTimestampSec: 311.5,
        triggerPhrase: 'Pause it! Let me check the Japanese laserdisc audio track real quick.',
        resumePhrase: 'Found the cue! Ready? Resuming film in 3, 2, 1, start!',
        confidence: 'medium',
        reason: 'Laserdisc audio comparison verification',
        enabled: true,
        crossfadeMs: 25,
      },
    ],
    anchorPoints: [
      {
        id: 'anchor-c1',
        commentarySec: 25.0,
        filmSec: 16.5,
        label: 'Cyborg optic camouflage drop from rooftop',
        type: 'visual_cue',
        driftMs: 0,
      },
      {
        id: 'anchor-c2',
        commentarySec: 210.0,
        filmSec: 161.5,
        label: 'Section 9 van tracking signal',
        type: 'dialogue_match',
        driftMs: 15,
      },
    ],
    segmentsToKeep: [
      {
        segmentIndex: 1,
        rawCommentaryStartSec: 8.5,
        rawCommentaryEndSec: 145.0,
        targetFilmStartSec: 0.0,
        targetFilmEndSec: 136.5,
        durationSec: 136.5,
      },
      {
        segmentIndex: 2,
        rawCommentaryStartSec: 185.0,
        rawCommentaryEndSec: 360.0,
        targetFilmStartSec: 136.5,
        targetFilmEndSec: 311.5,
        durationSec: 175.0,
      },
      {
        segmentIndex: 3,
        rawCommentaryStartSec: 415.0,
        rawCommentaryEndSec: 743.5,
        targetFilmStartSec: 311.5,
        targetFilmEndSec: 640.0,
        durationSec: 328.5,
      },
    ],
    summary: {
      totalRawDurationSec: 743.5,
      totalCutSec: 103.5,
      finalSyncedDurationSec: 640.0,
      pauseCount: 2,
      conformityStatus: 'in-sync',
      engineerNotes: 'Perfect 24.000 fps theatrical lock. All kanji debate pauses removed without audible clicks.',
    },
    commentaryTranscript: `[00:00:01] Host: Welcome back to Anime Vault. We are watching the 1995 masterpiece.
[00:00:08] Host: Start disc at countdown mark: 3, 2, 1, GO!
[00:02:25] Guest: Stop the film right here! That kanji sign in the background is a mistranslation!
[00:03:04] Guest: Okay, let us keep moving. Unpause in three, two, one, hit it!
[00:06:00] Guest: Pause it! Let me check the Japanese laserdisc audio track real quick.
[00:06:54] Guest: Found the cue! Ready? Resuming film in 3, 2, 1, start!`,
    filmDialogueOrCues: `00:00:00.000 --> 00:00:15.000
In the near future, corporate networks reach out to the stars...

00:02:16.500 --> 00:02:28.000
Major Motoko Kusanagi: "There's a lot of static in your brain."`,
  },
];
