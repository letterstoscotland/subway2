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







// --- BOARD LOGIC --- //
class SubwayBoard {
  constructor(config) {
@@ -158,7 +164,11 @@
  }

  updateClock(now) {
    this.el.clock.textContent = `Time Now ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;




  }

  updateHeadlines(now) {
@@ -233,19 +243,19 @@
    // Find last space before number/min/APPROACHING
    let splitIndex = msg.lastIndexOf(" ");
    if (msg.endsWith("APPROACHING") || msg.endsWith("terminated")) {
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
@@ -254,86 +264,86 @@
  }

  // --- ADVISORY LOGIC --- //
updateAdvisories(now) {
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
    this.el.advisoryA.textContent = "";
    this.el.advisoryB.textContent = "";
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

// --- INITIALIZE --- //
window.addEventListener("DOMContentLoaded", () => {
  new SubwayBoard(SUBWAY_CONFIG);
});
