/* =========================================================
   Spotify Clone — player logic (hardened)
   Fixes: NaN index, stuck play/pause icon, file:// errors
   ========================================================= */

"use strict";

(function () {
  /* -------------------------------------------------------
     1. Playlist data — single source of truth
     ------------------------------------------------------- */
  const songs = [
    { songName: "Athra Style",         artist: "Sidhu Moose Wala",  album: "Single",       filePath: "songs/1.mp3",  coverPath: "covers/1.jpg",  duration: "3:50" },
    { songName: "To The Star",         artist: "The PropheC",       album: "The PropheC",  filePath: "songs/2.mp3",  coverPath: "covers/2.jpg",  duration: "3:50" },
    { songName: "Unveiling The Magic", artist: "Adnan Dhool",       album: "Single",       filePath: "songs/3.mp3",  coverPath: "covers/3.jpg",  duration: "3:50" },
    { songName: "Kina Chir",           artist: "The PropheC",       album: "The PropheC",  filePath: "songs/4.mp3",  coverPath: "covers/4.jpg",  duration: "3:50" },
    { songName: "One Love",            artist: "Shubh",             album: "Shubh",        filePath: "songs/5.mp3",  coverPath: "covers/5.jpg",  duration: "3:50" },
    { songName: "Amplifier",           artist: "Imran Khan",        album: "Imran Khan",   filePath: "songs/6.mp3",  coverPath: "covers/6.jpg",  duration: "3:50" },
    { songName: "94 Flow",             artist: "Big Boi Deep",      album: "Big Boi Deep", filePath: "songs/7.mp3",  coverPath: "covers/7.jpg",  duration: "3:50" },
    { songName: "East Side Flow",      artist: "Sidhu Moose Wala",  album: "Single",       filePath: "songs/8.mp3",  coverPath: "covers/8.jpg",  duration: "3:50" },
    { songName: "Brown Rang",          artist: "Yo Yo Honey Singh", album: "Single",       filePath: "songs/9.mp3",  coverPath: "covers/9.jpg",  duration: "3:50" },
    { songName: "Selfmade",            artist: "Sidhu Moose Wala",  album: "Single",       filePath: "songs/10.mp3", coverPath: "covers/10.jpg", duration: "3:50" }
  ];

  /* -------------------------------------------------------
     2. Helpers
     ------------------------------------------------------- */
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const isFileProtocol = location.protocol === "file:";

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m + ":" + String(s).padStart(2, "0");
  }

  function setRangeFill(input) {
    if (!input) return;
    const min   = Number(input.min) || 0;
    const max   = Number(input.max) || 100;
    const value = Number(input.value) || 0;
    const pct   = max === min ? 0 : ((value - min) / (max - min)) * 100;
    input.style.setProperty("--_p", pct + "%");
  }

  /* -------------------------------------------------------
     3. DOM references
     ------------------------------------------------------- */
  const audio = new Audio();
  audio.preload = "metadata";

  const playerEl       = $(".player");
  const masterPlay     = $("#masterPlay");
  const masterPlayIcon = masterPlay ? masterPlay.querySelector("i") : null;
  const prevBtn        = $("#previous");
  const nextBtn        = $("#next");
  const shuffleBtn     = $("#shuffle");
  const repeatBtn      = $("#repeat");
  const repeatIcon     = repeatBtn ? repeatBtn.querySelector("i") : null;

  const progressBar    = $("#myProgressBar");
  const currentTimeEl  = $("#currentTime");
  const durationEl     = $("#duration");

  const volumeBar      = $("#volumeBar");
  const muteBtn        = $("#muteToggle");
  const muteIcon       = muteBtn ? muteBtn.querySelector("i") : null;

  const masterSongName = $("#masterSongName");
  const masterArtist   = $("#masterArtist");
  const playerArt      = $("#playerArt");

  const songItems      = $$(".songItem");

  /* -------------------------------------------------------
     4. State
     ------------------------------------------------------- */
  let songIndex  = 0;
  let isPlaying  = false;
  let isShuffle  = false;
  let repeatMode = "off";     // "off" | "all" | "one"
  let isSeeking  = false;
  let lastVolume = 1;

  /* -------------------------------------------------------
     5. Hydrate track list from data
     ------------------------------------------------------- */
  function hydrateTrackList() {
    const count = Math.min(songItems.length, songs.length);

    for (let i = 0; i < count; i++) {
      const item = songItems[i];
      const song = songs[i];
      if (!item || !song) continue;

      item.dataset.index = String(i);

      const img = $(".songItem__art img", item) || $("img", item);
      if (img) {
        img.src = song.coverPath;
        img.alt = song.songName + " cover";
      }

      const num = $(".songItem__num", item);
      if (num) num.textContent = String(i + 1);

      const nameEl = $(".songName", item);
      if (nameEl) nameEl.textContent = song.songName;

      const artistEl = $(".songArtist", item);
      if (artistEl) artistEl.textContent = song.artist;

      const albumEl = $(".songItem__album", item);
      if (albumEl) albumEl.textContent = song.album;

      // Only touch the .timestamp if it has no embedded <i> (old layout).
      const timeEl = $(".timestamp", item);
      if (timeEl && !timeEl.querySelector("i")) {
        timeEl.textContent = song.duration;
      }
    }

    // Hide any leftover rows beyond the data.
    for (let i = count; i < songItems.length; i++) {
      songItems[i].hidden = true;
    }
  }

  /* -------------------------------------------------------
     6. UI sync
     ------------------------------------------------------- */
  function setPlayIcon(playing) {
    if (!masterPlayIcon) return;
    masterPlayIcon.classList.toggle("fa-play", !playing);
    masterPlayIcon.classList.toggle("fa-pause", playing);
    if (masterPlay) {
      masterPlay.setAttribute("aria-label", playing ? "Pause" : "Play");
    }
  }

  function updateActiveTrack() {
    songItems.forEach((item, i) => {
      const isCurrent  = i === songIndex;
      const rowPlaying = isCurrent && isPlaying;

      item.classList.toggle("is-playing", isCurrent);
      item.classList.toggle("is-paused", isCurrent && !isPlaying);
      item.setAttribute("aria-current", isCurrent ? "true" : "false");

      const btn = $(".songItemPlay", item);
      if (!btn) return;

      const icon = btn.querySelector("i");
      if (icon) {
        icon.classList.toggle("fa-play", !rowPlaying);
        icon.classList.toggle("fa-pause", rowPlaying);
        icon.classList.toggle("fa-circle-play", !rowPlaying);
        icon.classList.toggle("fa-circle-pause", rowPlaying);
      }

      const song = songs[i];
      if (song) {
        btn.setAttribute("aria-label", (rowPlaying ? "Pause " : "Play ") + song.songName);
      }
    });
  }

  function updateVolumeIcon(volume) {
    if (!muteIcon) return;
    muteIcon.classList.remove("fa-volume-high", "fa-volume-low", "fa-volume-xmark");
    if (volume === 0) {
      muteIcon.classList.add("fa-volume-xmark");
    } else if (volume < 0.5) {
      muteIcon.classList.add("fa-volume-low");
    } else {
      muteIcon.classList.add("fa-volume-high");
    }
    if (muteBtn) muteBtn.setAttribute("aria-label", volume === 0 ? "Unmute" : "Mute");
  }

  /* -------------------------------------------------------
     7. Core playback
     ------------------------------------------------------- */
  function loadSong(index, autoplay) {
    if (typeof autoplay !== "boolean") autoplay = true;

    if (!Number.isInteger(index) || index < 0 || index >= songs.length) {
      console.warn("[player] invalid index:", index);
      return;
    }

    const song = songs[index];
    songIndex = index;
    audio.src = song.filePath;

    if (masterSongName) masterSongName.textContent = song.songName;
    if (masterArtist)   masterArtist.textContent   = song.artist;
    if (playerArt) {
      playerArt.src = song.coverPath;
      playerArt.alt = song.songName + " cover";
    }

    if (durationEl)    durationEl.textContent    = song.duration || "0:00";
    if (currentTimeEl) currentTimeEl.textContent = "0:00";
    if (progressBar) {
      progressBar.value = 0;
      setRangeFill(progressBar);
    }

    updateActiveTrack();

    // Media Session is broken on file:// — skip it there.
    if (!isFileProtocol && "mediaSession" in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title:  song.songName,
          artist: song.artist,
          album:  song.album,
          artwork: [{ src: song.coverPath, sizes: "512x512", type: "image/jpeg" }]
        });
      } catch (_) { /* ignore */ }
    }

    if (autoplay) safePlay();
  }

  function safePlay() {
    let promise;
    try {
      promise = audio.play();
    } catch (err) {
      console.warn("[player] play() threw:", err);
      revertToPaused();
      return;
    }
    if (promise && typeof promise.catch === "function") {
      promise.catch((err) => {
        console.warn("[player] playback prevented:", err && err.message);
        revertToPaused();
      });
    }
  }

  function revertToPaused() {
    isPlaying = false;
    setPlayIcon(false);
    if (playerEl) playerEl.classList.remove("is-playing");
    updateActiveTrack();
  }

  function togglePlay() {
    if (audio.paused) safePlay();
    else audio.pause();
  }

  function seekBy(seconds) {
    if (!Number.isFinite(audio.duration)) return;
    audio.currentTime = Math.min(
      Math.max(audio.currentTime + seconds, 0),
      audio.duration
    );
  }

  function setVolume(value) {
    const v = Math.min(Math.max(value, 0), 1);
    audio.volume = v;
    if (volumeBar) {
      volumeBar.value = String(v * 100);
      setRangeFill(volumeBar);
    }
    updateVolumeIcon(v);
  }

  function playNext(auto) {
    if (typeof auto !== "boolean") auto = false;
    if (songs.length === 0) return;

    let next;
    if (isShuffle && songs.length > 1) {
      do {
        next = Math.floor(Math.random() * songs.length);
      } while (next === songIndex);
    } else {
      next = songIndex + 1;
      if (next >= songs.length) {
        if (auto && repeatMode === "off") {
          audio.pause();
          audio.currentTime = 0;
          return;
        }
        next = 0;
      }
    }

    if (!Number.isInteger(next) || next < 0 || next >= songs.length) next = 0;
    loadSong(next, true);
  }

  function playPrev() {
    if (songs.length === 0) return;

    // Restart if we're deep into the track.
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }

    let prev;
    if (isShuffle && songs.length > 1) {
      do {
        prev = Math.floor(Math.random() * songs.length);
      } while (prev === songIndex);
    } else {
      prev = songIndex - 1;
      if (prev < 0) prev = songs.length - 1;
    }

    if (!Number.isInteger(prev) || prev < 0 || prev >= songs.length) prev = 0;
    loadSong(prev, true);
  }

  /* -------------------------------------------------------
     8. Audio events → drive the UI
     ------------------------------------------------------- */
  audio.addEventListener("play", () => {
    isPlaying = true;
    setPlayIcon(true);
    if (playerEl) playerEl.classList.add("is-playing");
    updateActiveTrack();
    if (!isFileProtocol && "mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "playing";
    }
  });

  audio.addEventListener("pause", () => {
    isPlaying = false;
    setPlayIcon(false);
    if (playerEl) playerEl.classList.remove("is-playing");
    updateActiveTrack();
    if (!isFileProtocol && "mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "paused";
    }
  });

  audio.addEventListener("loadedmetadata", () => {
    if (durationEl) durationEl.textContent = formatTime(audio.duration);
  });

  audio.addEventListener("timeupdate", () => {
    if (isSeeking || !Number.isFinite(audio.duration)) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    if (progressBar) {
      progressBar.value = String(pct);
      setRangeFill(progressBar);
    }
    if (currentTimeEl) currentTimeEl.textContent = formatTime(audio.currentTime);
  });

  audio.addEventListener("ended", () => {
    if (repeatMode === "one") {
      audio.currentTime = 0;
      safePlay();
      return;
    }
    playNext(true);
  });

  audio.addEventListener("error", () => {
    console.warn("[player] could not load:", audio.src);
  });

  /* -------------------------------------------------------
     9. Transport controls
     ------------------------------------------------------- */
  if (masterPlay) masterPlay.addEventListener("click", togglePlay);
  if (nextBtn)    nextBtn.addEventListener("click", () => playNext(false));
  if (prevBtn)    prevBtn.addEventListener("click", playPrev);

  if (shuffleBtn) {
    shuffleBtn.addEventListener("click", () => {
      isShuffle = !isShuffle;
      shuffleBtn.classList.toggle("is-active", isShuffle);
      shuffleBtn.setAttribute("aria-pressed", String(isShuffle));
    });
  }

  if (repeatBtn) {
    repeatBtn.addEventListener("click", () => {
      repeatMode = repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off";
      const isActive = repeatMode !== "off";
      repeatBtn.classList.toggle("is-active", isActive);
      repeatBtn.setAttribute("aria-pressed", String(isActive));
      if (repeatIcon) {
        repeatIcon.classList.toggle("fa-repeat", repeatMode !== "one");
        repeatIcon.classList.toggle("fa-1",     repeatMode === "one");
      }
      repeatBtn.setAttribute(
        "aria-label",
        repeatMode === "one" ? "Repeat one"
        : repeatMode === "all" ? "Repeat all"
        : "Repeat off"
      );
    });
  }

  /* -------------------------------------------------------
     10. Track list — delegated click per row
     ------------------------------------------------------- */
  songItems.forEach((item) => {
    item.addEventListener("click", () => {
      const index = Number(item.dataset.index);
      if (!Number.isInteger(index) || index < 0 || index >= songs.length) return;

      if (index === songIndex) {
        togglePlay();
        return;
      }
      loadSong(index, true);
    });
  });

  /* -------------------------------------------------------
     11. Progress bar (seek)
     ------------------------------------------------------- */
  if (progressBar) {
    progressBar.addEventListener("input", () => {
      isSeeking = true;
      setRangeFill(progressBar);
      if (Number.isFinite(audio.duration) && currentTimeEl) {
        currentTimeEl.textContent = formatTime(
          (Number(progressBar.value) / 100) * audio.duration
        );
      }
    });

    progressBar.addEventListener("change", () => {
      if (Number.isFinite(audio.duration)) {
        audio.currentTime = (Number(progressBar.value) / 100) * audio.duration;
      }
      isSeeking = false;
    });
  }

  /* -------------------------------------------------------
     12. Volume
     ------------------------------------------------------- */
  if (volumeBar) {
    volumeBar.addEventListener("input", () => {
      const v = Number(volumeBar.value) / 100;
      audio.volume = v;
      if (v > 0) lastVolume = v;
      setRangeFill(volumeBar);
      updateVolumeIcon(v);
    });
  }

  if (muteBtn) {
    muteBtn.addEventListener("click", () => {
      if (audio.volume > 0) {
        lastVolume = audio.volume;
        setVolume(0);
      } else {
        setVolume(lastVolume || 1);
      }
    });
  }

  /* -------------------------------------------------------
     13. Keyboard shortcuts
     ------------------------------------------------------- */
  document.addEventListener("keydown", (event) => {
    const active   = document.activeElement;
    const isRange  = active && active.tagName === "INPUT" && active.type === "range";
    const isButton = active && active.tagName === "BUTTON";

    switch (event.code) {
      case "Space":
        if (isButton || isRange) return;
        event.preventDefault();
        togglePlay();
        break;
      case "ArrowRight":
        if (isRange) return;
        event.preventDefault();
        seekBy(5);
        break;
      case "ArrowLeft":
        if (isRange) return;
        event.preventDefault();
        seekBy(-5);
        break;
      case "ArrowUp":
        if (isRange) return;
        event.preventDefault();
        setVolume(audio.volume + 0.05);
        break;
      case "ArrowDown":
        if (isRange) return;
        event.preventDefault();
        setVolume(audio.volume - 0.05);
        break;
      case "KeyM":
        if (isRange) return;
        event.preventDefault();
        if (muteBtn) muteBtn.click();
        break;
    }
  });

  /* -------------------------------------------------------
     14. Media Session (skipped on file://)
     ------------------------------------------------------- */
  if (!isFileProtocol && "mediaSession" in navigator) {
    try {
      navigator.mediaSession.setActionHandler("play",  () => safePlay());
      navigator.mediaSession.setActionHandler("pause", () => audio.pause());
      navigator.mediaSession.setActionHandler("nexttrack", () => playNext(false));
      navigator.mediaSession.setActionHandler("previoustrack", playPrev);
      navigator.mediaSession.setActionHandler("seekbackward", () => seekBy(-10));
      navigator.mediaSession.setActionHandler("seekforward",  () => seekBy(10));
    } catch (_) { /* ignore unsupported handlers */ }
  }

  /* -------------------------------------------------------
     15. Boot
     ------------------------------------------------------- */
  function init() {
    hydrateTrackList();
    setRangeFill(progressBar);
    setRangeFill(volumeBar);
    updateVolumeIcon(1);

    // Prepare the first track (no autoplay — browsers block it).
    loadSong(0, false);
    setPlayIcon(false);
    updateActiveTrack();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();