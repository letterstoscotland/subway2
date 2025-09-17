// --- CONFIGURATION --- //
const SUBWAY_CONFIG = {
  timeZone: "Europe/London",
  operatingHours: {
    // [startHour, endHour] in 24h format for each day (0=Sunday)
    0: [10.0, 18.5],    // Sunday: 10:00 - 18:30
    1: [6.5, 23.5],    // Monday: 06:30 - 23:30
    2: [6.5, 23.5],    // Tuesday
    3: [6.5, 23.5],    // Wednesday
    4: [6.5, 23.5],    // Thursday
    5: [6.5, 23.5],    // Friday
    6: [6.5, 23.5],    // Saturday
    endTimes: {
      0: [18, 21],     // Sunday
      1: [23, 21],     // Monday
      2: [23, 21],     // Tuesday
      3: [23, 21],     // Wednesday
      4: [23, 21],     // Thursday
      5: [23, 21],     // Friday
      6: [23, 21],     // Saturday
    }
  },
  headlines: {
    inner: [
      "Inner next arrival 8min",
      "Inner next arrival 7min",
      "Inner next arrival 6min",
      "Inner next arrival 5min",
      "Inner next arrival 4min",
      "Inner next arrival 3min",
      "Inner next arrival 2min",
      "Inner next arrival 1min",
      "INNER APPROACHING",
      "Inner service complete"
    ],
    outer: [
      "Outer next arrival 8min",
      "Outer next arrival 7min",
      "Outer next arrival 6min",
      "Outer next arrival 5min",
      "Outer next arrival 4min",
      "Outer next arrival 3min",
      "Outer next arrival 2min",
      "Outer next arrival 1min",
      "OUTER APPROACHING",
      "Outer service complete"
    ]
  },
  advisories: {
    base: [
      "Keep your belongings with you",
      "Please Mind the Gap",
      "Report anything suspicious",
      "Free Palestine",
      "Take care on the stairs",
      "Слава Україні!",
      "Line 2 tunneling underway"
    ],
    inserts: [
      { 
        text: "NEXT INNER TERMINATES AT GOVAN", 
        when: "inner_termination", 
        line: "A" 
      },
      { 
        text: "NEXT OUTER TERMINATES AT IBROX", 
        when: "outer_termination", 
        line: "B" 
      },
      { 
        text: "Football- system busy 1-6pm", 
        when: "football", 
        line: "both"
      }
    ]
  },
  advisoryCycleSeconds: 15,
  marqueeSpeed: 60, // px/sec
  approachingFlash: true
};

// --- UTILITY FUNCTIONS --- //
function getUKTime() {
  // Always get current time in Europe/London
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: SUBWAY_CONFIG.timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });
  const parts = fmt.formatToParts(new Date());
  const obj = {};
  parts.forEach(p => { obj[p.type] = p.value; });
  // Compose a date string in ISO format
  return new Date(
    `${obj.year}-${obj.month}-${obj.day}T${obj.hour}:${obj.minute}:${obj.second}`
  );
}

function pad(num, len = 2) {
  return num.toString().padStart(len, "0");
}

// --- REPLACE 0 WITH O FOR DISPLAY --- //
function replaceZeroWithO(str) {
  // Replace all digit 0 with uppercase letter O everywhere in the string UNDONE FOR NOW (replacement is 0)
  return String(str).replace(/0/g, "0");
}

// --- FIRST TRAIN CALCULATION --- //
function getFirstTrainTimes(config, now) {
  // Returns: { innerTime: "HH:MM", outerTime: "HH:MM", innerDay: #, outerDay: # }
  // Works for the next operating day after 'now'
  let day = now.getDay();
  let hour = now.getHours() + now.getMinutes() / 60;

  for (let i = 0; i < 7; i++) {
    let checkDay = (day + i) % 7;
    let [start, end] = config.operatingHours[checkDay];

    if (i === 0 && hour < start) {
      // Today, before start
    } else if (i > 0 && start !== undefined && end !== undefined) {
      // Next available day
    } else {
      continue;
    }

    let serviceStartMinutes = Math.round(start * 60);

    // Inner: offset = 3, cycle = 8
    let nInner = Math.ceil((serviceStartMinutes - 3) / 8);
    let firstInner = 3 + 8 * nInner;
    let innerHH = Math.floor(firstInner / 60);
    let innerMM = firstInner % 60;

    // Outer: offset = 8, cycle = 8
    let nOuter = Math.ceil((serviceStartMinutes - 8) / 8);
    let firstOuter = 8 + 8 * nOuter;
    let outerHH = Math.floor(firstOuter / 60);
    let outerMM = firstOuter % 60;

    let innerTime = `${pad(innerHH)}:${pad(innerMM)}`;
    let outerTime = `${pad(outerHH)}:${pad(outerMM)}`;

    return {
      innerTime,
      outerTime,
      innerDay: checkDay,
      outerDay: checkDay
    };
  }
  // Fallback
  return { innerTime: "--:--", outerTime: "--:--", innerDay: null, outerDay: null };
}

// --- NEXT ARRIVAL MINUTES UTILITY --- //
function getNextArrivalMinutes(now, offset, cycleMinutes) {
  // Returns the time (in minutes since midnight) of the next scheduled arrival for this line
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  // Find the smallest n so that offset + n * cycle >= minutesNow
  const n = Math.ceil((minutesNow - offset) / cycleMinutes);
  return offset + n * cycleMinutes;
}

// --- BOARD LOGIC --- //
class SubwayBoard {
  constructor(config) {
    this.config = config;
    // Headline countdown offsets (in minutes)
    this.innerOffset = 3; // Inner starts at 3min
    this.outerOffset = 8; // Outer starts at 8min
    this.cycleMinutes = 8;
    // Advisory state
    this.advisoryAIndex = 0;
    this.advisoryBIndex = 3; // Start offset so both advisories not same
    this.lastAdvisoryAChange = 0;
    this.lastAdvisoryBChange = 0;
    // DOM elements
    this.el = {
      headlineA_left: document.getElementById("headlineA-left"),
      headlineA_right: document.getElementById("headlineA-right"),
      headlineB_left: document.getElementById("headlineB-left"),
      headlineB_right: document.getElementById("headlineB-right"),
      advisoryA: document.getElementById("advisoryA-text"),
      advisoryB: document.getElementById("advisoryB-text"),
      clock: document.getElementById("clockText")
    };
    // For flashing logic
    this.innerIsApproaching = false;
    this.outerIsApproaching = false;
    this.innerApproachStart = null;
    this.outerApproachStart = null;
    this.start();
  }
  
  start() {
    this.updateAll();
    setInterval(() => this.updateAll(), 1000);
  }

  updateAll() {
    const now = getUKTime();
    this.updateClock(now);
    this.updateHeadlines(now);
    this.updateAdvisories(now);
  }

  isOperating(now) {
    const day = now.getDay();
    const hours = now.getHours() + now.getMinutes()/60;
    const [start, end] = this.config.operatingHours[day];
    return hours >= start && hours < end;
  }

  getLineEndTimeMinutes(now, line) {
    // line: "inner" or "outer"
    const day = now.getDay();
    const [endHour, endMin] = this.config.operatingHours.endTimes[day];
    return endHour * 60 + endMin;
  }

  updateHeadlines(now) {
    let innerMsg, outerMsg;
    let flashingA = false, flashingB = false;

    // --- INNER LINE LOGIC ---
    let innerInService = this.isOperating(now);
    let nextInnerArrivalMinutes = getNextArrivalMinutes(
      now,
      this.innerOffset,
      this.cycleMinutes
    );
    const innerEndTimeMinutes = this.getLineEndTimeMinutes(now, "inner");

    if (innerInService && nextInnerArrivalMinutes < innerEndTimeMinutes) {
      // Calculate minutes and seconds for countdown
      const secondsToday = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
      let innerCyclePosition = ((secondsToday / 60 - this.innerOffset) % this.cycleMinutes + this.cycleMinutes) % this.cycleMinutes;
      let innerMinRemain = this.cycleMinutes - Math.floor(innerCyclePosition);
      let innerSecRemain = 60 - (secondsToday % 60);

      if (innerMinRemain === 1 && innerSecRemain <= 10) {
        innerMsg = this.config.headlines.inner[8];
        flashingA = this.config.approachingFlash;
        if (!this.innerIsApproaching) {
          this.innerApproachStart = Date.now();
        }
        this.innerIsApproaching = true;
      } else {
        let index = Math.max(0, Math.min(7, this.cycleMinutes - innerMinRemain));
        innerMsg = this.config.headlines.inner[index];
        flashingA = false;
        this.innerIsApproaching = false;
        this.innerApproachStart = null;
      }
    } else {
      // OUTSIDE SERVICE OR LAST ARRIVAL SHOWN
      const next = getFirstTrainTimes(this.config, now);
      innerMsg = `First inner ${next.innerTime}`;
      flashingA = false;
      this.innerIsApproaching = false;
      this.innerApproachStart = null;
    }

    // --- OUTER LINE LOGIC ---
    let outerInService = this.isOperating(now);
    let nextOuterArrivalMinutes = getNextArrivalMinutes(
      now,
      this.outerOffset,
      this.cycleMinutes
    );
    const outerEndTimeMinutes = this.getLineEndTimeMinutes(now, "outer");

    if (outerInService && nextOuterArrivalMinutes < outerEndTimeMinutes) {
      // Calculate minutes and seconds for countdown
      const secondsToday = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
      let outerCyclePosition = ((secondsToday / 60 - this.outerOffset) % this.cycleMinutes + this.cycleMinutes) % this.cycleMinutes;
      let outerMinRemain = this.cycleMinutes - Math.floor(outerCyclePosition);
      let outerSecRemain = 60 - (secondsToday % 60);

      if (outerMinRemain === 1 && outerSecRemain <= 10) {
        outerMsg = this.config.headlines.outer[8];
        flashingB = this.config.approachingFlash;
        if (!this.outerIsApproaching) {
          this.outerApproachStart = Date.now();
        }
        this.outerIsApproaching = true;
      } else {
        let index = Math.max(0, Math.min(7, this.cycleMinutes - outerMinRemain));
        outerMsg = this.config.headlines.outer[index];
        flashingB = false;
        this.outerIsApproaching = false;
        this.outerApproachStart = null;
      }
    } else {
      // OUTSIDE SERVICE OR LAST ARRIVAL SHOWN
      const next = getFirstTrainTimes(this.config, now);
      outerMsg = `First outer ${next.outerTime}`;
      flashingB = false;
      this.outerIsApproaching = false;
      this.outerApproachStart = null;
    }

    // Split headline into left/right for alignment
    this.setHeadlineSplit(this.el.headlineA_left, this.el.headlineA_right, innerMsg, flashingA);
    this.setHeadlineSplit(this.el.headlineB_left, this.el.headlineB_right, outerMsg, flashingB);
  }

  setHeadlineSplit(leftEl, rightEl, msg, flashing=false) {
    // Find last space before number/min/APPROACHING
    let splitIndex = msg.lastIndexOf(" ");
    if (msg.endsWith("APPROACHING") || msg.endsWith("terminated")) {
      leftEl.textContent = replaceZeroWithO(msg);
      rightEl.textContent = "";
      leftEl.classList.toggle("flashing", flashing);
      rightEl.classList.remove("flashing");
    } else {
      let match = msg.match(/^(.+?)(\d+min)$/);
      if (match) {
        leftEl.textContent = replaceZeroWithO(match[1].trim());
        rightEl.textContent = replaceZeroWithO(match[2]);
        leftEl.classList.remove("flashing");
        rightEl.classList.remove("flashing");
      } else {
        leftEl.textContent = replaceZeroWithO(msg);
        rightEl.textContent = "";
        leftEl.classList.remove("flashing");
        rightEl.classList.remove("flashing");
      }
    }
  }

  updateClock(now) {
    const h = pad(now.getHours());
    const m = pad(now.getMinutes());
    const s = pad(now.getSeconds());
    this.el.clock.textContent = replaceZeroWithO(`Time Now ${h}:${m}:${s}`);
  }

  // --- ADVISORY LOGIC --- //
  updateAdvisories(now) {
    const day = now.getDay();
    const hour = now.getHours();
    const min = now.getMinutes();
    const month = now.getMonth();
    const isFootballSeason = (month >= 7 && month <= 10) || (month === 11 && hour < 18); // Aug-May, not Dec
    const isService = this.isOperating(now);

    let advisoryAMessages = [...this.config.advisories.base];
    let advisoryBMessages = [...this.config.advisories.base];

    // Football busy message
    if (
      isFootballSeason &&
      day === 6 &&
      hour >= 6 && hour < 18
    ) {
      advisoryAMessages.push("Football- system busy 1-6pm");
      advisoryBMessages.push("Football- system busy 1-6pm");
    }

    // Termination messages
    if (
      (hour >= 9 && hour < 11) ||
      (day !== 0 && hour >= 22 && hour < 23) ||
      (day === 0 && hour >= 17 && hour < 18)
    ) {
      advisoryAMessages.push("NEXT INNER TERMINATES AT GOVAN");
      advisoryBMessages.push("NEXT OUTER TERMINATES AT IBROX");
    }

    if (!isService) {
      this.el.advisoryA.textContent = "\u00A0";
      this.el.advisoryB.textContent = "\u00A0";
      return;
    }

    // Advisory cycling: never both the same message
    const nowMs = Date.now();
    if (!this.lastAdvisoryAChange || (nowMs - this.lastAdvisoryAChange) > this.config.advisoryCycleSeconds * 1000) {
      this.advisoryAIndex = (this.advisoryAIndex + 1) % advisoryAMessages.length;
      this.lastAdvisoryAChange = nowMs;
      
      // For B: advance to next message that's not equal to A
      let nextB = (this.advisoryBIndex + 1) % advisoryBMessages.length;
      if (advisoryBMessages[nextB] === advisoryAMessages[this.advisoryAIndex]) {
        nextB = (nextB + 1) % advisoryBMessages.length;
      }
      this.advisoryBIndex = nextB;
      this.lastAdvisoryBChange = nowMs + this.config.advisoryCycleSeconds * 500; // stagger
    }

    this.showAdvisory(this.el.advisoryA, advisoryAMessages[this.advisoryAIndex]);
    this.showAdvisory(this.el.advisoryB, advisoryBMessages[this.advisoryBIndex]);
  }

  showAdvisory(el, msg) {
    el.classList.remove("marqueeing");
    el.style.transform = "";
    el.textContent = replaceZeroWithO(msg);

    setTimeout(() => {
      const parent = el.parentNode;
      if (el.scrollWidth > parent.offsetWidth) {
        el.classList.add("marqueeing");
        let duration = (el.scrollWidth + parent.offsetWidth) / this.config.marqueeSpeed;
        el.animate([
          { transform: "translateX(0)" },
          { transform: `translateX(-${el.scrollWidth + 24}px)` }
        ], {
          duration: duration*1000,
          iterations: Infinity,
          easing: "linear"
        });
      }
    }, 50);
  }
}

// --- INITIALIZE --- //
window.addEventListener("DOMContentLoaded", () => {
  new SubwayBoard(SUBWAY_CONFIG);
});
