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
