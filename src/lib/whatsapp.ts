/** Link to chat with the studio, with the order number prefilled when known. Dependency-free (used in the browser). */
export function whatsappLink(number: string, orderId: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(`Hola, consulto por mi pedido ${orderId}`)}`;
}
