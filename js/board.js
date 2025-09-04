// --- CONFIGURATION --- //
const SUBWAY_CONFIG = {
  timeZone: "Europe/London",
  operatingHours: {
    0: [6.5, 18.5],
    1: [6.5, 23.5],
    2: [6.5, 23.5],
    3: [6.5, 23.5],
    4: [6.5, 23.5],
    5: [6.5, 23.5],
    6: [6.5, 23.5],
    endTimes: {
      0: [18, 21],
      1: [23, 21],
      2: [23, 21],
      3: [23, 21],
      4: [23, 21],
      5: [23, 21],
      6: [23, 21],
    }
  },
  headlines: {
    inner: [
      "Inner next arrival",
      "INNER",
      "First inner due"
    ],
    outer: [
      "Outer next arrival",
      "OUTER",
      "First outer due"
    ]
  },
  advisories: {
    base: [
      "Keep your belongings with you",
      "Please Mind the Gap",
      "Report anything suspicious"
    ]
  },
  advisoryCycleSeconds: 25,
  marqueeSpeed: 60,
  approachingFlash: true
};

function getUKTime() {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: SUBWAY_CONFIG.timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
  const parts = fmt.formatToParts(new Date());
  const obj = {};
  parts.forEach(p => { obj[p.type] = p.value; });
  return new Date(`${obj.year}-${obj.month}-${obj.day}T${obj.hour}:${obj.minute}:${obj.second}`);
}

function pad(num, len = 2) {
  return num.toString().padStart(len, "0");
}

// Format headline with a consistent gap before minutes/APPROACHING
function formatHeadline(main, right) {
  // Pad main to 22 characters (adjust as needed for your board)
  let padLen = Math.max(0, 22 - main.length);
  return main + " ".repeat(padLen) + right;
}

// --- FONT SCALING LOGIC FOR HEADLINE PANELS --- //
function scalePanelFonts() {
  // Find longest possible headline string (with gap and right part)
  const headlineSpans = [
    document.getElementById("headlineA-text"),
    document.getElementById("headlineB-text")
  ];
  const possibleHeadlines = [
    formatHeadline("Inner next arrival", "8min"),
    formatHeadline("Inner next arrival", "1min"),
    formatHeadline("INNER", "APPROACHING"),
    formatHeadline("First inner due", "O633"),
    formatHeadline("Outer next arrival", "8min"),
    formatHeadline("Outer next arrival", "1min"),
    formatHeadline("OUTER", "APPROACHING"),
    formatHeadline("First outer due", "O638")
  ];
  headlineSpans.forEach(span => {
    if (!span) return;
    const panel = span.parentNode;
    // Use font-family and styles from span
    const computed = window.getComputedStyle(span);
    const testSpan = document.createElement("span");
    testSpan.style.position = "absolute";
    testSpan.style.visibility = "hidden";
    testSpan.style.whiteSpace = "pre";
    testSpan.style.fontFamily = computed.fontFamily;
    testSpan.style.fontWeight = computed.fontWeight;
    testSpan.style.letterSpacing = computed.letterSpacing;
    testSpan.style.fontStyle = computed.fontStyle;
    testSpan.style.textTransform = computed.textTransform;
    document.body.appendChild(testSpan);

    let maxWidth = 0;
    let widestMsg = "";
    for (let msg of possibleHeadlines) {
      testSpan.textContent = msg;
      testSpan.style.fontSize = "48px";
      let w = testSpan.scrollWidth;
      if (w > maxWidth) {
        maxWidth = w;
        widestMsg = msg;
      }
    }

    // Fit font so widest message fits in panel width
    const panelHeight = panel.clientHeight;
    const panelWidth = panel.clientWidth;
    let fontSize = panelHeight * 0.97;
    testSpan.textContent = widestMsg;
    testSpan.style.fontSize = fontSize + "px";
    while (testSpan.scrollWidth > panelWidth && fontSize > 14) {
      fontSize -= 1;
      testSpan.style.fontSize = fontSize + "px";
    }
    span.style.fontSize = fontSize + "px";
    document.body.removeChild(testSpan);
  });

  // For advisories and clock
  ['advisoryA-text', 'advisoryB-text', 'clockText'].forEach(id => {
    const span = document.getElementById(id);
    if (!span) return;
    const panel = span.parentNode;
    const panelHeight = panel.clientHeight;
    span.style.fontSize = (panelHeight * 0.97) + "px";
  });
}

window.addEventListener('resize', scalePanelFonts);
window.addEventListener('DOMContentLoaded', () => {
  scalePanelFonts();
  new SubwayBoard(SUBWAY_CONFIG);
});

class SubwayBoard {
  constructor(config) {
    this.config = config;
    this.innerOffset = 3;
    this.outerOffset = 8;
    this.cycleMinutes = 8;
    this.advisoryAIndex = 0;
    this.advisoryBIndex = 1;
    this.lastAdvisoryAChange = 0;
    this.lastAdvisoryBChange = 0;
    this.el = {
      headlineA: document.getElementById("headlineA-text"),
      headlineB: document.getElementById("headlineB-text"),
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

  isServiceTerminated(now) {
    const day = now.getDay();
    const endHour = this.config.operatingHours.endTimes[day][0];
    const endMin = this.config.operatingHours.endTimes[day][1];
    const endTime = endHour + endMin/60;
    const hours = now.getHours() + now.getMinutes()/60;
    return hours >= endTime;
  }

  updateHeadlines(now) {
    // Calculate which message to show for each headline
    let innerMsg, outerMsg;
    const hour = now.getHours();
    const min = now.getMinutes();

    const isOperating = this.isOperating(now);
    const isTerminated = this.isServiceTerminated(now);

    const isFirstInner = (hour === 6 && min < 25);
    const isFirstOuter = (hour === 6 && min < 30);

    if (!isOperating || isTerminated) {
      innerMsg = formatHeadline("First inner due", "O633");
      outerMsg = formatHeadline("First outer due", "O638");
    } else if (isFirstInner) {
      innerMsg = formatHeadline("First inner due", "O633");
      outerMsg = formatHeadline("First outer due", "O638");
    } else if (!isFirstInner && isFirstOuter) {
      innerMsg = formatHeadline("Inner next arrival", "8min");
      outerMsg = formatHeadline("First outer due", "O638");
    } else {
      const secondsToday = hour * 3600 + min * 60 + now.getSeconds();

      // INNER
      let innerCyclePosition = ((secondsToday / 60 - this.innerOffset) % this.cycleMinutes + this.cycleMinutes) % this.cycleMinutes;
      let innerMinRemain = this.cycleMinutes - Math.floor(innerCyclePosition);
      let innerSecRemain = 60 - (secondsToday % 60);

      // OUTER
      let outerCyclePosition = ((secondsToday / 60 - this.outerOffset) % this.cycleMinutes + this.cycleMinutes) % this.cycleMinutes;
      let outerMinRemain = this.cycleMinutes - Math.floor(outerCyclePosition);
      let outerSecRemain = 60 - (secondsToday % 60);

      // "APPROACHING"
      if (innerMinRemain === 1 && innerSecRemain <= 10) {
        innerMsg = formatHeadline("INNER", "APPROACHING");
        this.el.headlineA.classList.add("flashing");
      } else {
        let mins = `${innerMinRemain}min`;
        innerMsg = formatHeadline("Inner next arrival", mins);
        this.el.headlineA.classList.remove("flashing");
      }

      if (outerMinRemain === 1 && outerSecRemain <= 10) {
        outerMsg = formatHeadline("OUTER", "APPROACHING");
        this.el.headlineB.classList.add("flashing");
      } else {
        let mins = `${outerMinRemain}min`;
        outerMsg = formatHeadline("Outer next arrival", mins);
        this.el.headlineB.classList.remove("flashing");
      }
    }

    this.el.headlineA.textContent = innerMsg;
    this.el.headlineB.textContent = outerMsg;
  }

  updateAdvisories(now) {
    const advisories = this.config.advisories.base;
    // Cycle messages
    const nowMs = Date.now();
    if (!this.lastAdvisoryAChange || (nowMs - this.lastAdvisoryAChange) > this.config.advisoryCycleSeconds * 1000) {
      this.advisoryAIndex = (this.advisoryAIndex + 1) % advisories.length;
      this.lastAdvisoryAChange = nowMs;
      this.advisoryBIndex = (this.advisoryBIndex + 1) % advisories.length;
      this.lastAdvisoryBChange = nowMs;
    }
    this.el.advisoryA.textContent = advisories[this.advisoryAIndex];
    this.el.advisoryB.textContent = advisories[this.advisoryBIndex];
  }

  updateClock(now) {
    this.el.clock.textContent = `Time Now ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }
}
