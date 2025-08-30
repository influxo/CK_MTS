import sequelize from '../connection';
import { v4 as uuidv4 } from 'uuid';
import {
  Project,
  Subproject,
  Activity,
  Service,
  ServiceAssignment,
  FormTemplate,
  FormResponse,
  BeneficiaryMapping,
  User,
  ServiceDelivery,
} from '../../models';
import FormEntityAssociation from '../../models/FormEntityAssociation';
import { upsertFromFormResponse } from '../../services/beneficiaries/beneficiariesService';

// Simple random helpers (no external deps)
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(arr: T[]): T => arr[randInt(0, arr.length - 1)];
const randomDateInPastDays = (daysBack: number): Date => {
  const now = new Date();
  const past = new Date(now);
  past.setDate(now.getDate() - randInt(0, daysBack));
  // jitter hours/minutes
  past.setHours(randInt(8, 17), randInt(0, 59), randInt(0, 59), 0);
  return past;
};

const FIRST_NAMES_M = ['Karim', 'Omar', 'Hassan', 'Fadi', 'Nabil', 'Samir', 'Ziad', 'Rami'];
const FIRST_NAMES_F = ['Amina', 'Maya', 'Nadia', 'Rana', 'Layla', 'Hala', 'Sara', 'Dalia'];
const LAST_NAMES = ['Hassan', 'Suleiman', 'Nassar', 'Khalil', 'Youssef', 'Rahman', 'Farah', 'Salem'];
const MUNICIPALITIES = ['Beirut', 'Tripoli', 'Saida', 'Zahle', 'Tyre', 'Byblos', 'Baalbek'];
const NATIONALITIES = ['Lebanese', 'Syrian', 'Palestinian', 'Iraqi'];
const PROJECT_NAMES = ['WASH Program', 'Food Security', 'Shelter Support', 'Cash Assistance', 'Education Access'];
const SUBPROJECT_THEMES = ['Distribution', 'Awareness', 'Training', 'Outreach', 'Assessment'];
const ACTIVITY_PREFIX = ['Session', 'Visit', 'Workshop', 'Distribution'];
const SERVICE_CATALOG = [
  { name: 'Hygiene Kit', category: 'In-kind' },
  { name: 'Cash Transfer', category: 'Cash' },
  { name: 'Food Parcel', category: 'In-kind' },
  { name: 'Counseling Session', category: 'Service' },
  { name: 'School Kit', category: 'In-kind' },
  { name: 'Rent Support', category: 'Cash' },
];

export async function seedProjectsBeneficiaries() {
  const encKey = process.env.BENEFICIARY_ENC_KEY;
  const hashKey = process.env.BENEFICIARY_HASH_KEY;
  if (!encKey || !hashKey) {
    throw new Error(
      'Missing BENEFICIARY_ENC_KEY or BENEFICIARY_HASH_KEY in environment. Cannot seed encrypted beneficiaries.'
    );
  }

  await sequelize.transaction(async (transaction) => {
    console.log('Seeding Projects/Subprojects/Activities/Services/Templates/Beneficiaries (expanded)...');

    // Staff users for submissions and deliveries
    const fieldUser = await User.findOne({ where: { email: 'field@example.com' }, transaction });
    const programUser = await User.findOne({ where: { email: 'program@example.com' }, transaction });
    const staffUser = fieldUser || programUser;
    if (!staffUser) throw new Error('No staff user found (field@example.com or program@example.com)');

    // Create multiple services (catalog)
    const services: Service[] = [];
    for (const s of SERVICE_CATALOG) {
      const created = await Service.findOrCreate({
        where: { name: s.name },
        defaults: { id: uuidv4(), name: s.name, description: s.name, category: s.category, status: 'active' },
        transaction,
      });
      services.push(created[0]);
    }

    // Create multiple projects with subprojects and activities
    const allSubprojects: Subproject[] = [];
    const subprojectActivities = new Map<string, Activity[]>();
    for (let p = 0; p < PROJECT_NAMES.length; p++) {
      const project = await Project.create({
        id: uuidv4(),
        name: PROJECT_NAMES[p],
        description: `${PROJECT_NAMES[p]} program`,
        category: PROJECT_NAMES[p].split(' ')[0],
        status: 'active',
      }, { transaction });

      const subCount = randInt(3, 5); // 3-5 subprojects per project (=> 15-25 total)
      for (let s = 0; s < subCount; s++) {
        const theme = pick(SUBPROJECT_THEMES);
        const sp = await Subproject.create({
          id: uuidv4(),
          name: `${theme} - ${project.name} ${s + 1}`,
          description: `${theme} subproject under ${project.name}`,
          category: theme,
          status: 'active',
          projectId: project.id,
        }, { transaction });
        allSubprojects.push(sp);

        // Assign a few services to project/subproject
        for (const svc of services) {
          if (Math.random() < 0.5) {
            await ServiceAssignment.findOrCreate({
              where: { serviceId: svc.id, entityId: project.id, entityType: 'project' },
              defaults: { id: uuidv4(), serviceId: svc.id, entityId: project.id, entityType: 'project' },
              transaction,
            });
          }
          if (Math.random() < 0.7) {
            await ServiceAssignment.findOrCreate({
              where: { serviceId: svc.id, entityId: sp.id, entityType: 'subproject' },
              defaults: { id: uuidv4(), serviceId: svc.id, entityId: sp.id, entityType: 'subproject' },
              transaction,
            });
          }
        }

        // Create 2-3 activities for each subproject
        const actCount = randInt(2, 3);
        const acts: Activity[] = [];
        for (let a = 0; a < actCount; a++) {
          const act = await Activity.create({
            id: uuidv4(),
            name: `${pick(ACTIVITY_PREFIX)} - ${sp.name} #${a + 1}`,
            description: `Activity under ${sp.name}`,
            category: 'Onsite',
            frequency: pick(['weekly', 'monthly']),
            reportingFields: { servedHouseholds: 'number', incidents: 'text' },
            subprojectId: sp.id,
            status: 'active',
          } as any, { transaction });
          acts.push(act);
        }
        subprojectActivities.set(sp.id, acts);
      }
    }

    // Create one Beneficiary Registration template shared across all subprojects
    const template = await FormTemplate.create({
      id: uuidv4(),
      name: 'Beneficiary Registration',
      schema: {
        fields: [
          { name: 'first_name', label: 'First Name', type: 'Text', required: true },
          { name: 'last_name', label: 'Last Name', type: 'Text', required: true },
          { name: 'dob', label: 'Date of Birth', type: 'Date', required: true },
          { name: 'national_id', label: 'National ID', type: 'Text' },
          { name: 'phone', label: 'Phone', type: 'Text' },
          { name: 'email', label: 'Email', type: 'Text' },
          { name: 'address', label: 'Address', type: 'Text' },
          { name: 'gender', label: 'Gender', type: 'Dropdown', options: ['M', 'F'] },
          { name: 'municipality', label: 'Municipality', type: 'Text' },
          { name: 'nationality', label: 'Nationality', type: 'Text' },
        ],
      },
      version: 1,
    }, { transaction });

    // Map and associate template to ALL subprojects
    await BeneficiaryMapping.upsert({
      id: uuidv4(),
      formTemplateId: template.id,
      mapping: {
        fields: {
          firstName: 'first_name',
          lastName: 'last_name',
          dob: 'dob',
          nationalId: 'national_id',
          phone: 'phone',
          email: 'email',
          address: 'address',
          gender: 'gender',
          municipality: 'municipality',
          nationality: 'nationality',
        },
        strategies: ['nationalId', 'phone+dob', 'name+dob'],
      },
    }, { transaction });

    for (const sp of allSubprojects) {
      await FormEntityAssociation.findOrCreate({
        where: { formTemplateId: template.id, entityId: sp.id, entityType: 'subproject' },
        defaults: { id: uuidv4(), formTemplateId: template.id, entityId: sp.id, entityType: 'subproject' },
        transaction,
      });
    }

    // Generate hundreds of randomized submissions/beneficiaries over last 180 days
    const TOTAL_SUBMISSIONS = 800;
    for (let i = 0; i < TOTAL_SUBMISSIONS; i++) {
      // Random person
      const gender = Math.random() < 0.5 ? 'M' : 'F';
      const first_name = gender === 'M' ? pick(FIRST_NAMES_M) : pick(FIRST_NAMES_F);
      const last_name = pick(LAST_NAMES);
      const year = randInt(1965, 2005);
      const month = randInt(1, 12);
      const day = randInt(1, 28);
      const dob = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const municipality = pick(MUNICIPALITIES);
      const nationality = pick(NATIONALITIES);
      const phone = `+961 ${randInt(70, 81)} ${randInt(100, 999)} ${randInt(100, 999)}`;
      const nidMaybe = Math.random() < 0.7 ? `ID-${last_name.slice(0,2).toUpperCase()}-${year}-${randInt(1000,9999)}` : null;
      const emailMaybe = Math.random() < 0.5 ? `${first_name.toLowerCase()}.${last_name.toLowerCase()}${randInt(1,99)}@example.com` : null;
      const address = `${randInt(1, 200)} Main St, ${municipality}`;

      // Pick a random subproject and one of its activities
      const sp = pick(allSubprojects);
      const acts = subprojectActivities.get(sp.id) || [];
      const activity = pick(acts);

      // Random timestamps over last 180 days
      const submittedAt = randomDateInPastDays(180);
      const deliveredAt = new Date(submittedAt.getTime() + randInt(0, 10) * 24 * 60 * 60 * 1000);

      const data = {
        first_name,
        last_name,
        dob,
        national_id: nidMaybe,
        phone,
        email: emailMaybe,
        address,
        gender,
        municipality,
        nationality,
      } as any;

      // Upsert beneficiary using service (ensures encryption and match keys)
      const entity = { entityId: sp.id, entityType: 'subproject' as const };
      const { beneficiaryId } = await upsertFromFormResponse(
        template.id,
        data,
        entity,
        { transaction, userId: staffUser.id }
      );

      // Create the form response
      const response = await FormResponse.create({
        id: uuidv4(),
        formTemplateId: template.id,
        entityId: sp.id,
        entityType: 'subproject',
        submittedBy: staffUser.id,
        beneficiaryId: beneficiaryId || null,
        data,
        submittedAt,
      }, { transaction });

      // Deliver a randomly assigned service that is available to this subproject (fallback to any)
      const assigned = await ServiceAssignment.findAll({
        where: { entityId: sp.id, entityType: 'subproject' },
        transaction,
      });
      const serviceId = assigned.length > 0 ? pick(assigned).get('serviceId') as string : pick(services).id;

      await ServiceDelivery.create({
        id: uuidv4(),
        serviceId,
        beneficiaryId: beneficiaryId!,
        entityId: activity.id,
        entityType: 'activity',
        formResponseId: response.id,
        staffUserId: staffUser.id,
        deliveredAt,
        notes: 'Seeded delivery record',
      }, { transaction });
    }

    console.log('Expanded seed completed: projects, subprojects, activities, services, template, mappings, ~800 submissions.');
  });
}

export default { seedProjectsBeneficiaries };
