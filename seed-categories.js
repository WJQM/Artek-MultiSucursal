const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get branch ID first
  const branches = await prisma.branch.findMany({ take: 1 });
  const branchId = branches[0]?.id;
  
  if (!branchId) {
    console.log("No branches found");
    return;
  }
  
  console.log("Branch ID:", branchId);
  
  // Inventory categories from the screenshot
  const inventoryCats = [
    "Baterías", "Cables", "Cargadores", "Discos HDD", 
    "Discos NVME", "Discos SSD", "Discos Sata III",
    "Memorias RAM", "Otros", "Pantallas", "Teclados", "Laptops"
  ];
  
  await prisma.keyValue.upsert({
    where: { key: `inv_cats_${branchId}` },
    update: { value: JSON.stringify(inventoryCats) },
    create: { key: `inv_cats_${branchId}`, value: JSON.stringify(inventoryCats) },
  });
  
  console.log("✓ Inventory categories saved:", inventoryCats.length);
  console.log("Key used:", `inv_cats_${branchId}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
