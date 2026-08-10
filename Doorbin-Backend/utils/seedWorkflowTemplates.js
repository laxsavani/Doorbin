const WorkflowTemplate = require('../models/WorkflowTemplate');

const defaultTemplates = [
  {
    projectCategory: 'Architecture',
    stages: [
      {
        name: 'Stage 1 - Scene Preparation',
        order: 1,
        approvalRequired: false,
        subStages: [
          { name: 'Building', order: 1, isRepeatableGroup: false, checklist: [] },
          { name: 'Site Development', order: 2, isRepeatableGroup: false, checklist: [] },
          { name: 'Vegetation & Landscape', order: 3, isRepeatableGroup: false, checklist: [] },
          { name: 'Context Development', order: 4, isRepeatableGroup: false, checklist: [] }
        ]
      },
      {
        name: 'Stage 2 - Sketch Development',
        order: 2,
        approvalRequired: false,
        subStages: [
          {
            name: 'Sketch 01',
            order: 1,
            isRepeatableGroup: false,
            checklist: ['Composition', 'Mood & Lighting', 'Post Production']
          }
        ]
      },
      {
        name: 'Stage 3 - Final Rendering',
        order: 3,
        approvalRequired: true,
        subStages: [
          {
            name: 'Final Render',
            order: 1,
            isRepeatableGroup: false,
            checklist: ['Client Feedback', 'Post Production']
          }
        ]
      }
    ]
  },
  {
    projectCategory: 'Interior Design',
    stages: [
      {
        name: 'Stage 1 - First Draft',
        order: 1,
        approvalRequired: false,
        subStages: [
          { name: 'Modeling', order: 1, isRepeatableGroup: true, checklist: [] },
          { name: 'Texturing', order: 2, isRepeatableGroup: true, checklist: [] },
          { name: 'Lighting & Rendering', order: 3, isRepeatableGroup: true, checklist: [] },
          { name: 'Post Production', order: 4, isRepeatableGroup: true, checklist: [] }
        ]
      },
      {
        name: 'Stage 2 - Revision Cycle',
        order: 2,
        approvalRequired: true,
        subStages: [
          { name: 'Revision 1', order: 1, isRepeatableGroup: false, checklist: [] },
          { name: 'Revision 2', order: 2, isRepeatableGroup: false, checklist: [] },
          { name: 'Final Approval', order: 3, isRepeatableGroup: false, checklist: [] }
        ]
      }
    ]
  },
  {
    projectCategory: 'Animation',
    stages: [
      {
        name: 'Stage 1 - Pre-Production',
        order: 1,
        approvalRequired: false,
        subStages: [
          { name: 'Story & Script', order: 1, isRepeatableGroup: false, checklist: [] },
          { name: 'Storyboard', order: 2, isRepeatableGroup: false, checklist: [] },
          { name: 'Moodboard', order: 3, isRepeatableGroup: false, checklist: [] }
        ]
      },
      {
        name: 'Stage 2 - Shot Composition',
        order: 2,
        approvalRequired: true,
        subStages: [
          { name: 'Composition', order: 1, isRepeatableGroup: true, checklist: [] },
          { name: 'Camera Animation', order: 2, isRepeatableGroup: true, checklist: [] },
          { name: 'Scene Animation', order: 3, isRepeatableGroup: true, checklist: [] },
          { name: 'Mood & Lighting', order: 4, isRepeatableGroup: true, checklist: [] },
          { name: 'Rendering', order: 5, isRepeatableGroup: true, checklist: [] },
          { name: 'Post Production', order: 6, isRepeatableGroup: true, checklist: [] }
        ]
      }
    ]
  }
];

const seedWorkflowTemplates = async () => {
  try {
    for (const tpl of defaultTemplates) {
      const exists = await WorkflowTemplate.findOne({ projectCategory: tpl.projectCategory });
      if (!exists) {
        await WorkflowTemplate.create(tpl);
        console.log(`Seeded WorkflowTemplate: ${tpl.projectCategory}`);
      }
    }
    console.log('✅ Baseline 3 Workflow Templates seeded/verified successfully!');
  } catch (error) {
    console.error('Error seeding WorkflowTemplates:', error.message);
  }
};

module.exports = seedWorkflowTemplates;
