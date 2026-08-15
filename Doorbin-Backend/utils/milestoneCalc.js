/**
 * Shared Calculation Utility for Milestone Payments
 * Replicated exactly from client's Excel file formulas
 */
function computeMilestoneRollup(milestoneDoc, project) {
  const totalProjectValue = project?.budget != null && Number(project.budget) > 0
    ? Number(project.budget)
    : null;

  const rawMilestones = milestoneDoc?.milestones || [];
  
  // Ensure array has 5 milestone slots
  const milestones5 = [1, 2, 3, 4, 5].map(num => {
    const existing = rawMilestones.find(m => m.milestoneNumber === num);
    if (existing) {
      const amt = existing.amount != null ? Number(existing.amount) : null;
      return {
        _id: existing._id,
        milestoneNumber: num,
        amount: amt,
        dateReceived: existing.dateReceived,
        status: existing.status || 'Due'
      };
    }
    return {
      milestoneNumber: num,
      amount: null,
      dateReceived: null,
      status: 'Due'
    };
  });

  const milestonesWithPercent = milestones5.map(m => {
    const pct = (m.amount != null && totalProjectValue) ? (m.amount / totalProjectValue) : null;
    return {
      ...m,
      percent: pct,
      percentFormatted: pct != null ? `${Math.round(pct * 100)}%` : null
    };
  });

  const percentCheck = milestonesWithPercent.reduce((sum, m) => sum + (m.percent || 0), 0);

  const totalReceived = milestonesWithPercent
    .filter(m => m.status === 'Received')
    .reduce((sum, m) => sum + (m.amount || 0), 0);

  const wip = milestonesWithPercent
    .filter(m => m.status === 'WIP')
    .reduce((sum, m) => sum + (m.amount || 0), 0);

  const balanceDue = milestonesWithPercent
    .filter(m => m.status === 'Due')
    .reduce((sum, m) => sum + (m.amount || 0), 0);

  return {
    totalProjectValue,
    milestones: milestonesWithPercent,
    percentCheck: Math.round(percentCheck * 10000) / 10000,
    percentCheckFormatted: `${Math.round(percentCheck * 100)}%`,
    percentCheckValid: Math.abs(percentCheck - 1.0) < 0.001 || milestonesWithPercent.every(m => m.amount == null),
    totalReceived,
    wip,
    balanceDue
  };
}

module.exports = {
  computeMilestoneRollup
};
