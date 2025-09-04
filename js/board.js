// --- CONFIGURATION --- //
const SUBWAY_CONFIG = {
  timeZone: "Europe/London",
  operatingHours: {
    // [startHour, endHour] in 24h format for each day (0=Sunday)
    0: [6.5, 18.5],    // Sunday: 06:30 - 18:30
    1: [6.5, 23.5],    // Monday: 06:30 - 23:30
    2: [6.5, 23.5],    // Tuesday: 06:30 - 23:30
    3: [6.5, 23.5],    // Wednesday: 06:30 - 23:30
    4: [6.5, 23.5],    // Thursday: 06:30 - 23:30
    5: [6.5, 23.5],    // Friday: 06:30 - 23:30
    6: [6.5, 23.5],    // Saturday: 06:30 - 23:30
    // Termination times: [hour, min] for last service (for each day, 0=Sunday)
    endTimes: {
      0: [18, 21],     // Sunday: 18:21
      1: [23, 21],     // Monday: 23:21
      2: [23, 21],     // Tuesday: 23:21
      3: [23, 21],     // Wednesday: 23:21
      4: [23, 21],     // Thursday: 23:21
      5: [23, 21],     // Friday: 23:21
      6: [23, 21],     // Saturday: 23:21
    }
  },
  headlines: {
    inner: [
      // These are the messages that will rotate for the "inner" line
      "Inner next arrival 8min",
      "Inner next arrival 7min",
      "Inner next arrival 6min",
      "Inner next arrival 5min",
      "Inner next arrival 4min",
      "Inner next arrival 3min",
      "Inner next arrival 2min",
      "Inner next arrival 1min",
      "INNER APPROACHING"
      // "First inner due O633" is handled in logic and also included for font scaling
    ],
    outer: [
      // These are the messages that will rotate for the "outer" line
      "Outer next arrival 8min",
      "Outer next arrival 7min",
      "Outer next arrival 6min",
      "Outer next arrival 5min",
      "Outer next arrival 4min",
      "Outer next arrival 3min",
      "Outer next arrival 2min",
      "Outer next arrival 1min",
      "OUTER APPROACHING"
      // "First outer due O638" is handled in logic and also included for font scaling
    ]
  },
  advisories: {
    // Base advisories always available
    base: [
      "Keep your belongings with you",
      "Please Mind the Gap",
      "Report anything suspicious"
    ],
    // Inserts may be conditionally added
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
  advisoryCycleSeconds: 25, // How long each advisory message is displayed
  marqueeSpeed: 60, // px/sec for advisory marquee
  approachingFlash: true // Whether "APPROACHING" should flash
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

// --- FONT SCALING LOGIC FOR PANELS --- //
// Headlines and clock: font-size based on longest message in planned rotation.
// Advisories: font-size based only on panel height (can always marquee).
function scalePanelFonts() {
  // Headline panels and their longest message (detected from config)
  const headlinePanels = [
    { selector: '.headlineA', messages: SUBWAY_CONFIG.headlines.inner },
    { selector: '.headlineB', messages: SUBWAY_CONFIG.headlines.outer }
  ];

  // Determine longest message for each headline panel
  headlinePanels.forEach(({selector, messages}) => {
    const panel = document.querySelector(selector);
    if (!panel) return;
    const span = panel.querySelector('span');
    if (!span) return;

    // Find longest message in rotation
    let longestMsg = messages.reduce((a, b) => a.length > b.length ? a : b, "");
    // Add special 'First inner due O633' or 'First outer due O638' if needed
    if (selector === '.headlineA') {
      longestMsg = longestMsg.length > "First inner due O633".length ? longestMsg : "First inner due O633";
    } else if (selector === '.headlineB') {
      longestMsg = longestMsg.length > "First outer due O638".length ? longestMsg : "First outer due O638";
    }

    // Fit font size so longestMsg fits in panel width and panel height
    fitFont(panel, span, longestMsg, 0.97);

    // Prevent wrap/overflow
    span.style.whiteSpace = 'nowrap';
    span.style.overflow = 'hidden';
    span.style.textOverflow = 'ellipsis';
  });

  // Clock panel: use max possible string
  const clockPanel = document.querySelector('.clock');
  if (clockPanel) {
    const clockSpan = clockPanel.querySelector('span');
    if (clockSpan) {
      fitFont(clockPanel, clockSpan, "Time Now 23:59:59", 0.97);
      clockSpan.style.whiteSpace = 'nowrap';
      clockSpan.style.overflow = 'hidden';
      clockSpan.style.textOverflow = 'ellipsis';
    }
  }

  // Advisories: font-size based on panel height only (no length calculation)
  ['.advisoryA', '.advisoryB'].forEach(selector => {
    const panel = document.querySelector(selector);
    if (!panel) return;
    const span = panel.querySelector('span');
    if (!span) return;
    // Set font-size to 97% of panel height
    const panelHeight = panel.clientHeight;
    span.style.fontSize = `${panelHeight * 0.97}px`;
    // Allow overflow/marquee as before
    span.style.whiteSpace = 'nowrap';
    span.style.overflow = '';
    span.style.textOverflow = '';
  });
}

// Helper: fit font for longest message, vertically and horizontally
function fitFont(panel, span, message, maxHeightPct = 0.97) {
  // Create offscreen test span
  const testSpan = document.createElement("span");
  testSpan.style.position = "absolute";
  testSpan.style.visibility = "hidden";
  testSpan.style.whiteSpace = "nowrap";
  testSpan.style.fontFamily = window.getComputedStyle(span).fontFamily;
  testSpan.textContent = message;
  document.body.appendChild(testSpan);

  // Start with font-size = panel height * maxHeightPct
  const panelHeight = panel.clientHeight;
  let fontSize = panelHeight * maxHeightPct;

  // Reduce until fits horizontally
  testSpan.style.fontSize = fontSize + "px";
  while (testSpan.scrollWidth > panel.clientWidth && fontSize > 5) {
    fontSize -= 1;
    testSpan.style.fontSize = fontSize + "px";
  }

  // Apply result
  span.style.fontSize = fontSize + "px";
  document.body.removeChild(testSpan);
}

// Run scaling at startup and on resize
window.addEventListener('resize', scalePanelFonts);
window.addEventListener('DOMContentLoaded', () => {
  scalePanelFonts();
});

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
    // No need to call scalePanelFonts here (font-size is fixed across all content changes)
  }

  isOperating(now) {
    // Returns true if within operating hours
    const day = now.getDay();
    const hours = now.getHours() + now.getMinutes()/60;
    const [start, end] = this.config.operatingHours[day];
    return hours >= start && hours < end;
  }

  isServiceTerminated(now) {
    // Returns true if past daily termination time
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

    // "First inner due O633" until 06:25, then switch to countdown
    // "First outer due O638" until 06:30, then switch to countdown
    const isFirstInner = (hour === 6 && min < 25);
    const isFirstOuter = (hour === 6 && min < 30);

    if (!isOperating || isTerminated) {
      innerMsg = "First inner due O633";
      outerMsg = "First outer due O638";
    } else if (isFirstInner) {
      innerMsg = "First inner due O633";
      outerMsg = "First outer due O638";
    } else if (!isFirstInner && isFirstOuter) {
      innerMsg = this.config.headlines.inner[0];
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

      // Strict order: index = 8 - (minutes remaining - 1), so 8min = index 0, 7min = index 1, ..., 1min = index 7, APPROACHING = index 8
      // For "APPROACHING": if innerMinRemain === 1 and innerSecRemain <= 10
      // Show "APPROACHING" for exactly 10 seconds, then reset
      // INNER
      if (innerMinRemain === 1 && innerSecRemain <= 10) {
        innerMsg = this.config.headlines.inner[8];
        flashingA = this.config.approachingFlash;
        if (!this.innerIsApproaching) this.innerApproachStart = Date.now();
        this.innerIsApproaching = true;
      } else {
        // Find headline index: 8min = 0, 7min = 1, ..., 1min = 7
        let index = Math.max(0, Math.min(7, this.cycleMinutes - innerMinRemain));
        innerMsg = this.config.headlines.inner[index];
        flashingA = false;
        this.innerIsApproaching = false;
        this.innerApproachStart = null;
      }

      // OUTER
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

    // Split headline into left/right for alignment
    this.setHeadlineSplit(this.el.headlineA_left, this.el.headlineA_right, innerMsg, flashingA);
    this.setHeadlineSplit(this.el.headlineB_left, this.el.headlineB_right, outerMsg, flashingB);
  }

  setHeadlineSplit(leftEl, rightEl, msg, flashing=false) {
    // Find last space before number/min/APPROACHING
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

  // --- ADVISORY LOGIC --- //
  updateAdvisories(now) {
    const day = now.getDay();
    const hour = now.getHours();
    const min = now.getMinutes();
    const month = now.getMonth();

    const isFootballSeason = (month >= 7 && month <= 10) || (month === 11 && hour < 18); // Aug-May, not Dec
    const isOperating = this.isOperating(now);
    const isTerminated = this.isServiceTerminated(now);

    const isFirstInner = (hour === 6 && min < 25);
    const isFirstOuter = (hour === 6 && min < 30);

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
        let duration = (el.scrollWidth + parent.offsetWidth) / SUBWAY_CONFIG.marqueeSpeed;
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
