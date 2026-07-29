import { Prisma, PrismaClient } from '@prisma/client';
import { documentTemplates } from '../src/lib/document-center/catalog';

const prisma = new PrismaClient();
const jsonValue = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

async function main() {
  await prisma.$transaction(
    documentTemplates.map((template) =>
      prisma.documentTemplate.upsert({
        where: {
          key_version: { key: template.key, version: template.version },
        },
        update: {
          name: template.name,
          category: template.category,
          description: template.description,
          estimatedMinutes: template.estimatedMinutes,
          active: template.active,
          lastReviewedAt: new Date(template.lastReviewedAt),
          legalStatus: template.legalStatus,
          legalNotice: template.legalNotice,
          officialFormWarning: template.officialFormWarning ?? null,
          schema: jsonValue(template.fields),
          content: jsonValue(template.sections),
          sources: jsonValue(template.sources),
          signatureRoles: jsonValue(template.signatureRoles),
          tags: template.tags,
        },
        create: {
          key: template.key,
          name: template.name,
          category: template.category,
          description: template.description,
          estimatedMinutes: template.estimatedMinutes,
          version: template.version,
          active: template.active,
          lastReviewedAt: new Date(template.lastReviewedAt),
          legalStatus: template.legalStatus,
          legalNotice: template.legalNotice,
          officialFormWarning: template.officialFormWarning ?? null,
          schema: jsonValue(template.fields),
          content: jsonValue(template.sections),
          sources: jsonValue(template.sources),
          signatureRoles: jsonValue(template.signatureRoles),
          tags: template.tags,
        },
      })
    )
  );
  console.log(`${documentTemplates.length} Belge Merkezi şablonu eşitlendi.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
