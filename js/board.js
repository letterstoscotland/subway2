// --- CONFIGURATION --- //
const SUBWAY_CONFIG = {
  timeZone: "Europe/London",
  operatingHours: {
    // [startHour, endHour] in 24h format for each day (0=Sunday)
    0: [6.5, 18.5],    // Sunday: 06:30 - 18:30
    1: [6.5, 23.5],    // Monday
    2: [6.5, 23.5],    // Tuesday
    3: [1.0, 23.5],    // Wednesday
    4: [6.5, 23.5],    // Thursday
    5: [6.5, 23.5],    // Friday
    6: [6.5, 23.5],    // Saturday
    // End of service for display logic: final approach at 18:21/23:21
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
      "Inner service terminated"
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
      "Outer service terminated"
    ]
  },
  advisories: {
    base: [
      "Keep your belongings with you",
      "Please Mind the Gap",
      "Report anything suspicious"
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
  advisoryCycleSeconds: 25,
  advisoryBlankSeconds: 25,
  marqueeSpeed: 60, // px/sec
  approachingFlash: true
};

// --- UTILITY FUNCTIONS --- //
function getUKTime() {
  // Use Intl.DateTimeFormat for proper timezone handling
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
    this.advisoryBIndex = 1; // Start offset so both advisories not same
    this.advisoryABlank = false;
    this.advisoryBBlank = true;
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

  isServiceTerminated(now, inner=true) {
    // Last approach at 1821/2321, then terminated
    const day = now.getDay();
    const endHour = this.config.operatingHours.endTimes[day][0];
    const endMin = this.config.operatingHours.endTimes[day][1];
    const endTime = endHour + endMin/60;
    const hours = now.getHours() + now.getMinutes()/60;
    return hours >= endTime;
  }

  updateClock(now) {
    this.el.clock.textContent = `Time Now ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }

  updateHeadlines(now) {
    // Determine headline message and time
    let innerMsg, outerMsg;
    let flashingA = false, flashingB = false;

    if (!this.isOperating(now) || this.isServiceTerminated(now, true)) {
      innerMsg = this.config.headlines.inner[9];
      outerMsg = this.config.headlines.outer[9];
    } else {
      // Calculate remaining minutes until next train for each
      const secondsToday = now.getHours()*3600 + now.getMinutes()*60 + now.getSeconds();

      // Inner offset
      let innerCycleStart = ((secondsToday / 60 - this.innerOffset) % this.cycleMinutes + this.cycleMinutes) % this.cycleMinutes;
      let innerMin = this.cycleMinutes - Math.floor(innerCycleStart);
      let innerSec = 60 - (secondsToday % 60);
      if (innerMin === 0 && innerSec <= 10) {
        innerMsg = this.config.headlines.inner[8]; // "INNER APPROACHING"
        flashingA = this.config.approachingFlash;
      } else {
        innerMsg = this.config.headlines.inner[Math.max(0, Math.min(8, innerMin))];
      }

      // Outer offset
      let outerCycleStart = ((secondsToday / 60 - this.outerOffset) % this.cycleMinutes + this.cycleMinutes) % this.cycleMinutes;
      let outerMin = this.cycleMinutes - Math.floor(outerCycleStart);
      let outerSec = 60 - (secondsToday % 60);
      if (outerMin === 0 && outerSec <= 10) {
        outerMsg = this.config.headlines.outer[8]; // "OUTER APPROACHING"
        flashingB = this.config.approachingFlash;
      } else {
        outerMsg = this.config.headlines.outer[Math.max(0, Math.min(8, outerMin))];
      }
    }

    // Split headline into left/right for alignment
    this.setHeadlineSplit(this.el.headlineA_left, this.el.headlineA_right, innerMsg, flashingA);
    this.setHeadlineSplit(this.el.headlineB_left, this.el.headlineB_right, outerMsg, flashingB);
  }

  setHeadlineSplit(leftEl, rightEl, msg, flashing=false) {
    // Find last space before number/min/APPROACHING
    let splitIndex = msg.lastIndexOf(" ");
    if (msg.endsWith("APPROACHING") || msg.endsWith("terminated")) {
      leftEl.textContent = msg;
      rightEl.textContent = "";
    } else {
      let match = msg.match(/^(.+?)(\d+min)$/);
      if (match) {
        leftEl.textContent = match[1].trim();
        rightEl.textContent = match[2];
      } else {
        leftEl.textContent = msg;
        rightEl.textContent = "";
      }
    }
    [leftEl, rightEl].forEach(el => el.classList.remove("flashing"));
    if (flashing) {
      leftEl.classList.add("flashing");
    }
  }

  // --- ADVISORY LOGIC --- //
  updateAdvisories(now) {
    // Determine which messages to show, including timed inserts
    const day = now.getDay();
    const hour = now.getHours();
    const min = now.getMinutes();
    const month = now.getMonth();
    const isFootballSeason = (month >= 7 && month <= 10) || (month === 11 && hour < 18); // Aug-May, not Dec
    const isService = this.isOperating(now) && !this.isServiceTerminated(now);

    let advisoryAMessages = [...this.config.advisories.base];
    let advisoryBMessages = [...this.config.advisories.base];

    // Football busy message
    if (
      isFootballSeason &&
      day === 6 && // Saturday
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

    // Blank advisories if service terminated
    if (!isService) {
      this.el.advisoryA.textContent = "";
      this.el.advisoryB.textContent = "";
      return;
    }

    // Rotation logic, offset so they're not in sync
    if (!this.lastAdvisoryAChange || performance.now() - this.lastAdvisoryAChange > (this.config.advisoryCycleSeconds + this.config.advisoryBlankSeconds)*1000) {
      this.advisoryAIndex = (this.advisoryAIndex + 1) % advisoryAMessages.length;
      this.lastAdvisoryAChange = performance.now();
      this.advisoryABlank = false;
    }
    if (!this.lastAdvisoryBChange || performance.now() - this.lastAdvisoryBChange > (this.config.advisoryCycleSeconds + this.config.advisoryBlankSeconds)*1000) {
      this.advisoryBIndex = (this.advisoryBIndex + 1) % advisoryBMessages.length;
      this.lastAdvisoryBChange = performance.now() + this.config.advisoryCycleSeconds*500; // start offset
      this.advisoryBBlank = false;
    }

    // After cycleSeconds, blank; then next message
    if (performance.now() - this.lastAdvisoryAChange > this.config.advisoryCycleSeconds*1000) {
      this.el.advisoryA.textContent = "";
      this.advisoryABlank = true;
    } else {
      this.showAdvisory(this.el.advisoryA, advisoryAMessages[this.advisoryAIndex]);
    }
    if (performance.now() - this.lastAdvisoryBChange > this.config.advisoryCycleSeconds*1000) {
      this.el.advisoryB.textContent = "";
      this.advisoryBBlank = true;
    } else {
      this.showAdvisory(this.el.advisoryB, advisoryBMessages[this.advisoryBIndex]);
    }
  }

  showAdvisory(el, msg) {
    // If too long, marquee
    el.classList.remove("marqueeing");
    el.style.transform = "";
    el.textContent = msg;
    // Measure text width
    setTimeout(() => {
      const parent = el.parentNode;
      if (el.scrollWidth > parent.offsetWidth) {
        // Marquee!
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
console.log("DEBUG UK time:", getUKTime());
// --- INITIALIZE --- //
window.addEventListener("DOMContentLoaded", () => {
  new SubwayBoard(SUBWAY_CONFIG);
});
