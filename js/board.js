// --- CONFIGURATION --- //
const SUBWAY_CONFIG = {
  timeZone: "Europe/London",
  operatingHours: {
    // [startHour, endHour] in 24h format for each day (0=Sunday)
    0: [6.5, 18.5],    // Sunday: 06:30 - 18:30
    1: [6.5, 23.5],    // Monday
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
  marqueeSpeed: 60, // px/sec
  approachingFlash: true
};

// --- UTILITY FUNCTIONS --- //
function getUKTime() {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: SUBWAY_CONFIG.timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });
  const parts = fmt.formatToParts(new Date());
  const obj = {};
  parts.forEach(p => { obj[p.type] = p.value; });
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
    this.innerOffset = 3; // Inner starts at 3min
    this.outerOffset = 8; // Outer starts at 8min
    this.cycleMinutes = 8;
    this.advisoryAIndex = 0;
    this.advisoryBIndex = 1;
    this.lastAdvisoryAChange = 0;
    this.lastAdvisoryBChange = 0;
    this.el = {
      headlineA_left: document.getElementById("headlineA-left"),
      headlineA_right: document.getElementById("headlineA-right"),
      headlineB_left: document.getElementById("headlineB-left"),
      headlineB_right: document.getElementById("headlineB-right"),
      advisoryA: document.getElementById("advisoryA-text"),
      advisoryB: document.getElementById("advisoryB-text"),
      clock: document.getElementById("clockText")
    };
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

  isServiceTerminated(now) {
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
    let innerMsg, outerMsg;
    let flashingA = false, flashingB = false;

    const hour = now.getHours();
    const min = now.getMinutes();

    const isOperating = this.isOperating(now);
    const isTerminated = this.isServiceTerminated(now);

    // "First inner due O633" until 06:25, then switch to 8min countdown
    // "First outer due O638" until 06:30, then switch to 8min countdown
    const isFirstInner = (hour === 6 && min < 25);
    const isFirstOuter = (hour === 6 && min < 30);

    if (!isOperating || isTerminated) {
      innerMsg = "First inner due O633";
      outerMsg = "First outer due O638";
    } else if (isFirstInner) {
      innerMsg = "First inner due O633";
      outerMsg = "First outer due O638";
    } else if (!isFirstInner && isFirstOuter) {
      innerMsg = this.config.headlines.inner[0]; // Start 8min countdown for inner
      outerMsg = "First outer due O638";
    } else {
      // Normal countdown calculation: always progress 8,7,6,...1,APPROACHING
      const secondsToday = hour*3600 + min*60 + now.getSeconds();

      // INNER
      let innerCyclePosition = ((secondsToday / 60 - this.innerOffset) % this.cycleMinutes + this.cycleMinutes) % this.cycleMinutes;
      let innerMinRemain = this.cycleMinutes - Math.floor(innerCyclePosition);
      let innerSecRemain = 60 - (secondsToday % 60);

      // OUTER
      let outerCyclePosition = ((secondsToday / 60 - this.outerOffset) % this.cycleMinutes + this.cycleMinutes) % this.cycleMinutes;
      let outerMinRemain = this.cycleMinutes - Math.floor(outerCyclePosition);
      let outerSecRemain = 60 - (secondsToday % 60);

      // Strict order: index = 8 - (minutes remaining - 1)
      if (innerMinRemain === 1 && innerSecRemain <= 10) {
        innerMsg = this.config.headlines.inner[8];
        flashingA = this.config.approachingFlash;
        if (!this.innerIsApproaching) this.innerApproachStart = Date.now();
        this.innerIsApproaching = true;
      } else {
        let index = Math.max(0, Math.min(7, this.cycleMinutes - innerMinRemain));
        innerMsg = this.config.headlines.inner[index];
        flashingA = false;
        this.innerIsApproaching = false;
        this.innerApproachStart = null;
      }

      if (outerMinRemain === 1 && outerSecRemain <= 10) {
        outerMsg = this.config.headlines.outer[8];
        flashingB = this.config.approachingFlash;
        if (!this.outerIsApproaching) this.outerApproachStart = Date.now();
        this.outerIsApproaching = true;
      } else {
        let index = Math.max(0, Math.min(7, this.cycleMinutes - outerMinRemain));
        outerMsg = this.config.headlines.outer[index];
        flashingB = false;
        this.outerIsApproaching = false;
        this.outerApproachStart = null;
      }
    }

    this.setHeadlineSplit(this.el.headlineA_left, this.el.headlineA_right, innerMsg, flashingA);
    this.setHeadlineSplit(this.el.headlineB_left, this.el.headlineB_right, outerMsg, flashingB);
  }

  setHeadlineSplit(leftEl, rightEl, msg, flashing=false) {
    if (
      msg.endsWith("APPROACHING") ||
      msg.startsWith("First inner due") ||
      msg.startsWith("First outer due")
    ) {
      leftEl.textContent = msg;
      rightEl.textContent = "";
      leftEl.classList.toggle("flashing", flashing);
      rightEl.classList.remove("flashing");
    } else {
      let match = msg.match(/^(.+?)(\d+min)$/);
      if (match) {
        leftEl.textContent = match[1].trim();
        rightEl.textContent = match[2];
        leftEl.classList.remove("flashing");
        rightEl.classList.remove("flashing");
      } else {
        leftEl.textContent = msg;
        rightEl.textContent = "";
        leftEl.classList.remove("flashing");
        rightEl.classList.remove("flashing");
      }
    }
  }

  updateAdvisories(now) {
    const day = now.getDay();
    const hour = now.getHours();
    const min = now.getMinutes();
    const month = now.getMonth();

    const isFootballSeason = (month >= 7 && month <= 10) || (month === 11 && hour < 18);
    const isOperating = this.isOperating(now);
    const isTerminated = this.isServiceTerminated(now);

    const isFirstInner = (hour === 6 && min < 25);
    const isFirstOuter = (hour === 6 && min < 30);

    let advisoryAMessages = [...this.config.advisories.base];
    let advisoryBMessages = [...this.config.advisories.base];

    if (
      isFootballSeason &&
      day === 6 &&
      hour >= 6 && hour < 18
    ) {
      advisoryAMessages.push("Football- system busy 1-6pm");
      advisoryBMessages.push("Football- system busy 1-6pm");
    }

    if (
      (hour >= 9 && hour < 11) ||
      (day !== 0 && hour >= 22 && hour < 23) ||
      (day === 0 && hour >= 17 && hour < 18)
    ) {
      advisoryAMessages.push("NEXT INNER TERMINATES AT GOVAN");
      advisoryBMessages.push("NEXT OUTER TERMINATES AT IBROX");
    }

    // Show "not in service" only during first service and terminated periods
    if (!isOperating || isTerminated || isFirstInner || isFirstOuter) {
      this.el.advisoryA.textContent = "Inner not in service";
      this.el.advisoryB.textContent = "Outer not in service";
      return;
    }

    // Advisory cycling resumes when countdown starts
    const nowMs = Date.now();
    if (!this.lastAdvisoryAChange || (nowMs - this.lastAdvisoryAChange) > this.config.advisoryCycleSeconds * 1000) {
      this.advisoryAIndex = (this.advisoryAIndex + 1) % advisoryAMessages.length;
      this.lastAdvisoryAChange = nowMs;
      let nextB = (this.advisoryBIndex + 1) % advisoryBMessages.length;
      if (advisoryBMessages[nextB] === advisoryAMessages[this.advisoryAIndex]) {
        nextB = (nextB + 1) % advisoryBMessages.length;
      }
      this.advisoryBIndex = nextB;
      this.lastAdvisoryBChange = nowMs + this.config.advisoryCycleSeconds * 500;
    }

    this.showAdvisory(this.el.advisoryA, advisoryAMessages[this.advisoryAIndex]);
    this.showAdvisory(this.el.advisoryB, advisoryBMessages[this.advisoryBIndex]);
  }

  showAdvisory(el, msg) {
    el.classList.remove("marqueeing");
    el.style.transform = "";
    el.textContent = msg;

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

window.addEventListener("DOMContentLoaded", () => {
  new SubwayBoard(SUBWAY_CONFIG);
});
