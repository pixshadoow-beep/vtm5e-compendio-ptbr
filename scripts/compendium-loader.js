const MODULE_ID = "vtm5e-compendio-ptbr";
const DATA_VERSION = "2.1.0";

const PACK_LIST = [
  "clas",
  "ressonancias",
  "tipos-de-predador",
  "vantagens-e-defeitos",
  "disciplinas",
  "loresheets"
];

async function populateSinglePack(packName, force = false) {
  const fullPackId = `${MODULE_ID}.${packName}`;
  const pack = game.packs.get(fullPackId);
  if (!pack) {
    console.warn(`[${MODULE_ID}] Compêndio não encontrado: ${fullPackId}`);
    return;
  }

  await pack.getIndex();
  if (!force && pack.index.size > 0) {
    return;
  }

  console.log(`[${MODULE_ID}] Populando compêndio oficial ${fullPackId}...`);
  const response = await fetch(`modules/${MODULE_ID}/data/${packName}.json`);
  if (!response.ok) {
    console.error(`[${MODULE_ID}] Falha ao carregar JSON: ${packName}.json`);
    return;
  }
  const data = await response.json();

  const wasLocked = pack.locked;
  if (wasLocked) {
    await pack.configure({ locked: false });
  }

  try {
    if (force && pack.index.size > 0) {
      const existingItems = await pack.getDocuments();
      if (existingItems.length > 0) {
        const ids = existingItems.map(d => d.id);
        await Item.deleteDocuments(ids, { pack: fullPackId });
      }
      if (pack.folders && pack.folders.size > 0) {
        const folderIds = pack.folders.map(f => f.id);
        await Folder.deleteDocuments(folderIds, { pack: fullPackId });
      }
    }

    if (Array.isArray(data.folders) && data.folders.length > 0) {
      await Folder.createDocuments(data.folders, { pack: fullPackId, keepId: true });
    }

    if (Array.isArray(data.items) && data.items.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < data.items.length; i += batchSize) {
        const batch = data.items.slice(i, i + batchSize);
        await Item.createDocuments(batch, { pack: fullPackId, keepId: true });
      }
    }
    console.log(`[${MODULE_ID}] Compêndio ${fullPackId} concluído (${data.items?.length || 0} itens).`);
  } catch (err) {
    console.error(`[${MODULE_ID}] Erro ao popular ${fullPackId}:`, err);
  } finally {
    if (wasLocked) {
      await pack.configure({ locked: true });
    }
  }
}

async function populateAllPacks(force = false) {
  if (!game.user.isGM) return;
  ui.notifications.info("🦇 [Vampiro V5 PT-BR] Atualizando todos os compêndios oficiais para Português integral...");
  for (const packName of PACK_LIST) {
    await populateSinglePack(packName, force);
  }
  await game.settings.set(MODULE_ID, "loadedVersion", DATA_VERSION);
  ui.notifications.info("🩸 [Vampiro V5 PT-BR] Compêndio 100% oficial e traduzido com sucesso!");
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "loadedVersion", {
    name: "Versão Carregada do Compêndio PT-BR",
    scope: "world",
    config: false,
    type: String,
    default: ""
  });

  window.VTM5E_PTBR = {
    populateAllPacks,
    populateSinglePack
  };
});

Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  const currentVer = game.settings.get(MODULE_ID, "loadedVersion");
  const clasPack = game.packs.get(`${MODULE_ID}.clas`);
  await clasPack?.getIndex();
  const isEmpty = !clasPack || clasPack.index.size === 0;

  if (isEmpty || currentVer !== DATA_VERSION) {
    await populateAllPacks(true);
  }
});
