export function formatarNumero(numero) {
  if (numero >= 1000) {
    return (numero / 1000).toFixed(1) + "k";
  }

  return numero;
}