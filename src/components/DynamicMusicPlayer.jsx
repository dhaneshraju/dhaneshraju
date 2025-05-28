import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import main1 from '../assets/Main-page/doingdamage.mp3';
import main2 from '../assets/Main-page/instinct.mp3';
import main3 from '../assets/Main-page/epic.mp3';
import main4 from '../assets/Main-page/echoesfromthemountain.mp3';
import main5 from '../assets/Main-page/echoofsadness.mp3';
import main6 from '../assets/Main-page/elevate.mp3';
import main7 from '../assets/Main-page/goinghigher.mp3';
import main8 from '../assets/Main-page/keepitreal.mp3';
import main9 from '../assets/Main-page/punky.mp3';
import main10 from '../assets/Main-page/yesterday.mp3';

import about1 from '../assets/About-page/anewbeginning.mp3';
import about2 from '../assets/About-page/birthofahero.mp3';
import about3 from '../assets/About-page/againstallodds.mp3';
import about4 from '../assets/About-page/beyondtheline.mp3';
import about5 from '../assets/About-page/creativeminds.mp3';
import about6 from '../assets/About-page/groovyhiphop.mp3';
import about7 from '../assets/About-page/happiness.mp3';
import about8 from '../assets/About-page/moose.mp3';
import about9 from '../assets/About-page/perception.mp3';
import about10 from '../assets/About-page/dreams.mp3';


const playlists = {
  mainPage: [main1, main2, main3, main4, main5, main6, main7, main8, main9, main10],
  aboutpage: [about1, about2, about3, about4, about5, about6, about7, about8, about9, about10],
};

export default function DynamicMusicPlayer({ page = 'mainPage', mute = false, volume = 0.01 }) {
  const playlist = useMemo(() => playlists[page] || [], [page]);
  const audioRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Function to handle play with user interaction
  const handlePlay = useCallback((isRetry = false) => {
    const audio = audioRef.current;
    if (!audio || isPlaying) return;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          if (process.env.NODE_ENV === 'development') {
            console.log('Playback started successfully');
          }
          setIsPlaying(true);
        })
        .catch(error => {
          if (!isRetry) {
            // Only log the first attempt to reduce console noise
            if (process.env.NODE_ENV === 'development') {
              console.log('Audio will play after user interaction');
            }
            // Set up a one-time interaction listener to retry playback
            const handleUserInteraction = () => {
              document.removeEventListener('click', handleUserInteraction);
              document.removeEventListener('keydown', handleUserInteraction);
              // Retry with isRetry flag to prevent duplicate logs
              handlePlay(true);
            };
            
            document.addEventListener('click', handleUserInteraction, { once: true });
            document.addEventListener('keydown', handleUserInteraction, { once: true });
          }
        });
    }
  }, [isPlaying]);

  // Handle volume and mute changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Clamp volume between 0 and 1
    const vol = Math.min(Math.max(volume, 0), 1);

    if (mute) {
      audio.volume = 0;
      audio.pause();
      if (process.env.NODE_ENV === 'development') {
        console.log('Audio muted');
      }
      setIsPlaying(false);
    } else {
      audio.volume = vol;
      if (process.env.NODE_ENV === 'development') {
        console.log('Volume set to:', vol);
      }
      handlePlay();
    }
  }, [mute, volume, handlePlay]);

  // Handle track changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onEnded = () => {
      setCurrentIndex(i => (i + 1) % playlist.length);
    };

    audio.addEventListener('ended', onEnded);

    // When changing tracks, try to play if not muted
    if (!mute) {
      handlePlay();
    }

    return () => {
      audio.removeEventListener('ended', onEnded);
    };
  }, [currentIndex, mute, playlist.length, handlePlay]);

  // Set up initial interaction listener
  useEffect(() => {
    const handleFirstInteraction = () => {
      if (!mute) {
        handlePlay();
      }
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };

    // Add interaction listeners if not already playing
    if (!isPlaying && !mute) {
      document.addEventListener('click', handleFirstInteraction, { once: true });
      document.addEventListener('keydown', handleFirstInteraction, { once: true });
    }

    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [mute, isPlaying, handlePlay]);

  if (playlist.length === 0) return null;

  return (
    <audio
      ref={audioRef}
      src={playlist[currentIndex]}
      autoPlay
      controls={false}
      preload="auto"
      style={{ display: 'none' }}
    />
  );
}



// import React, { useEffect, useRef, useState, useMemo } from 'react';
// import main1 from '../assets/Main-page/doingdamage.mp3';
// import main2 from '../assets/Main-page/instinct.mp3';
// import main3 from '../assets/Main-page/epic.mp3';
// import main4 from '../assets/Main-page/unlock-me-amapiano-music-149058.mp3';
// import main5 from '../assets/Main-page/unlock-me-amapiano-music-149058.mp3';
// import main6 from '../assets/Main-page/unlock-me-amapiano-music-149058.mp3';
// import main7 from '../assets/Main-page/unlock-me-amapiano-music-149058.mp3';
// import main8 from '../assets/Main-page/unlock-me-amapiano-music-149058.mp3';
// import main9 from '../assets/Main-page/unlock-me-amapiano-music-149058.mp3';
// import main10 from '../assets/Main-page/unlock-me-amapiano-music-149058.mp3';
// // import aboutMusic from '../ass
// // ets/audio/about-ambient.mp3'; // Add your about page music
// import about1 from '../assets/Main-page/unlock-me-amapiano-music-149058.mp3';
// // import about2 from '../assets/About-page/unlock-me-amapiano-music-149058.mp3';
// // import about3 from '../assets/About-page/unlock-me-amapiano-music-149058.mp3';
// // import about4 from '../assets/About-page/unlock-me-amapiano-music-149058.mp3';
// // import about5 from '../assets/About-page/unlock-me-amapiano-music-149058.mp3';
// // import about6 from '../assets/About-page/unlock-me-amapiano-music-149058.mp3';
// // import about7 from '../assets/About-page/unlock-me-amapiano-music-149058.mp3';
// // import about8 from '../assets/About-page/unlock-me-amapiano-music-149058.mp3';
// // import about9 from '../assets/About-page/unlock-me-amapiano-music-149058.mp3';
// // import about10 from '../assets/About-page/unlock-me-amapiano-music-149058.mp3';


// const playlists = {
//   mainPage: [main1, main2, main3, main4, main5, main6, main7, main8, main9, main10],
//   aboutPage: [about1], // Add your about page music
//   // aboutPage: [aboutMusic, about1, about2, about3, about4, about5, about6, about7, about8, about9, about10],
// };

// export default function DynamicMusicPlayer({ page = 'mainPage', mute = false, volume = 0.01 }) {
//   const playlist = useMemo(() => playlists[page] || [], [page]);
//   const audioRef = useRef(null);
//   const [currentIndex, setCurrentIndex] = useState(0);
//   const [isUserInteracted, setIsUserInteracted] = useState(false);

//   // Handle user interaction
//   useEffect(() => {
//     const handleInteraction = () => {
//       setIsUserInteracted(true);
//     };

//     window.addEventListener('click', handleInteraction, { once: true });
//     window.addEventListener('keydown', handleInteraction, { once: true });

//     return () => {
//       window.removeEventListener('click', handleInteraction);
//       window.removeEventListener('keydown', handleInteraction);
//     };
//   }, []);

//   useEffect(() => {
//     const audio = audioRef.current;
//     if (!audio || !isUserInteracted) return;

//     const vol = Math.min(Math.max(volume, 0), 1);

//     if (mute) {
//       audio.volume = 0;
//       audio.pause();
//       console.log(`Music Player (${page}): Muted`);
//     } else {
//       audio.volume = vol;
//       audio.play()
//         .then(() => console.log(`Music Player (${page}): Playing at volume ${vol}`))
//         .catch(e => console.warn(`Music Player (${page}): Playback failed:`, e));
//     }

//     const onEnded = () => {
//       setCurrentIndex(i => (i + 1) % playlist.length);
//     };

//     audio.addEventListener('ended', onEnded);

//     return () => {
//       audio.removeEventListener('ended', onEnded);
//       audio.pause();
//     };
//   }, [currentIndex, mute, volume, playlist.length, page, isUserInteracted]);

//   if (playlist.length === 0) {
//     console.warn(`Music Player: No tracks found for page "${page}"`);
//     return null;
//   }

//   return (
//     <div className="dynamic-music-player">
//       <audio
//         ref={audioRef}
//         src={playlist[currentIndex]}
//         autoPlay={isUserInteracted}
//         loop
//         controls={false}
//         preload="auto"
//         style={{ display: 'none' }}
//       />
//       {!isUserInteracted && (
//         <div className="music-prompt">
//           Click anywhere to enable ambient sound
//         </div>
//       )}
//     </div>
//   );
// }




// import React, { useEffect, useRef, useState, useMemo } from 'react';
// import main1 from '../assets/Main-page/doingdamage.mp3';
// import main2 from '../assets/Main-page/instinct.mp3';
// import main3 from '../assets/Main-page/epic.mp3';
// // import main4 from '../assets/Main-page/unlock-me-amapiano-music-149058.mp3';


// import about1 from '../assets/Main-page/unlock-me-amapiano-music-149058.mp3';

// const playlists = {
//   mainPage: [main1, main2, main3],
//   aboutPage: [about1],
// };

// export default function DynamicMusicPlayer({ page = 'mainPage', mute = false, volume = 0.2 }) {
//   const playlist = useMemo(() => playlists[page] || [], [page]);
//   const audioRef = useRef(null);
//   const [currentIndex, setCurrentIndex] = useState(0);
//   const [isUserInteracted, setIsUserInteracted] = useState(false);

//   // Handle user interaction
//   useEffect(() => {
//     const handleInteraction = () => {
//       setIsUserInteracted(true);
//       // Try to play audio immediately after user interaction
//       if (audioRef.current) {
//         audioRef.current.play().catch(console.error);
//       }
//     };

//     window.addEventListener('click', handleInteraction);
//     window.addEventListener('keydown', handleInteraction);

//     return () => {
//       window.removeEventListener('click', handleInteraction);
//       window.removeEventListener('keydown', handleInteraction);
//     };
//   }, []);

//   // Handle audio playback
//   useEffect(() => {
//     const audio = audioRef.current;
//     if (!audio) return;

//     const vol = Math.min(Math.max(volume, 0), 1);
//     audio.volume = vol;

//     const playCurrentTrack = () => {
//       if (!mute && isUserInteracted) {
//         audio.play()
//           .then(() => console.log(`Now playing track ${currentIndex + 1}/${playlist.length}`))
//           .catch(e => console.warn('Playback failed:', e));
//       }
//     };

//     const handleEnded = () => {
//       const nextIndex = (currentIndex + 1) % playlist.length;
//       console.log(`Track ended. Moving to track ${nextIndex + 1}`);
//       setCurrentIndex(nextIndex);
//     };

//     audio.addEventListener('ended', handleEnded);
    
//     if (isUserInteracted && !mute) {
//       playCurrentTrack();
//     }

//     return () => {
//       audio.removeEventListener('ended', handleEnded);
//       audio.pause();
//     };
//   }, [currentIndex, mute, volume, playlist.length, isUserInteracted]);

//   if (playlist.length === 0) return null;

//   return (
//     <div className="dynamic-music-player">
//       <audio
//         ref={audioRef}
//         src={playlist[currentIndex]}
//         preload="auto"
//       />
//       {!isUserInteracted && (
//         <div className="music-prompt">
//           Click anywhere to start music
//         </div>
//       )}
//       <div className="track-info" style={{ position: 'fixed', bottom: '10px', left: '10px', color: '#00ffff', fontSize: '12px', opacity: 0.7 }}>
//         {isUserInteracted && `Playing ${currentIndex + 1}/${playlist.length}`}
//       </div>
//     </div>
//   );
// }
