const TERMOS_BLOQUEADOS = [
  /\bmacac[oa]s?\b/i,
  /\bcrioulo?s?\b/i,
  /\bnegrinh[oa]s?\b/i,
  /\bpreto?s?\s+(?:imund[oa]s?|nojent[oa]s?|burros?|lixos?)\b/i,
  /\bjudeu?s?\s+(?:imund[oa]s?|nojent[oa]s?|lixos?)\b/i,
  /\bnordestin[oa]s?\s+(?:imund[oa]s?|nojent[oa]s?|burros?|lixos?)\b/i,
  /\b(?:viado|bicha|sapat[aã]o|traveco)s?\b/i,
  /\b(?:retardad[oa]|aleijad[oa])s?\b/i,
  /\b(?:se\s+mate|vai\s+se\s+matar)\b/i,
];

const AMEACAS = [
  /\b(?:vou|vamos)\s+(?:te\s+)?(?:matar|espancar|agredir|quebrar)\b/i,
  /\b(?:merece|merecem)\s+(?:apanhar|morrer|ser\s+expuls[oa]s?)\b/i,
];

function normalizarTexto(texto = "") {
  return String(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[@#$%*&_+=|\\/<>(){}[\]0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function analisarConteudo(texto) {
  const normalizado = normalizarTexto(texto);

  if (!normalizado) {
    return { aprovado: true };
  }

  if (TERMOS_BLOQUEADOS.some((regex) => regex.test(normalizado))) {
    return {
      aprovado: false,
      motivo:
        "Conteúdo bloqueado por linguagem discriminatória, injuriosa ou ofensiva.",
    };
  }

  if (AMEACAS.some((regex) => regex.test(normalizado))) {
    return {
      aprovado: false,
      motivo: "Conteúdo bloqueado por ameaça ou incitação à violência.",
    };
  }

  return { aprovado: true };
}

function bloquearSeNecessario(texto, res) {
  const resultado = analisarConteudo(texto);

  if (resultado.aprovado) {
    return false;
  }

  res.status(422).json({
    erro: resultado.motivo,
    codigo: "CONTEUDO_BLOQUEADO",
  });

  return true;
}

module.exports = {
  analisarConteudo,
  bloquearSeNecessario,
};
