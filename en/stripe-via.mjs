// Counted ways from the English buy page on to Stripe (same pattern as /til/buy/). One path per Payment Link, so a
// discount never shares a way with the full price. No cookies. If a link has no way, the button goes to Stripe itself,
// never to the wrong price. Currency is unchanged on the link (valuta.js).
import { stripeClientReference, withClientReference } from '../landing/kilde.mjs';

export var STRIPE_VIA = {
  'https://buy.stripe.com/bJe14p0QhdRnfdkdz9gnK00': 'til/stripe-person/',
  'https://buy.stripe.com/cNi7sNeH7aFb7KS0MngnK01': 'til/stripe-family/',
  'https://buy.stripe.com/fZu7sN42tcNj5CK7aLgnK02': 'til/stripe-person-chessluke/',
  'https://buy.stripe.com/4gM5kF0QhbJffdkamXgnK03': 'til/stripe-family-chessluke/',
  'https://buy.stripe.com/9B628taqR3cJgho66HgnK04': 'til/stripe-person-advent20/',
  'https://buy.stripe.com/28EaEZ56x28FaX42UvgnK05': 'til/stripe-family-advent20/',
  'https://buy.stripe.com/00w9AVeH73cJ8OW2UvgnK06': 'til/stripe-person-lukas50/',
  'https://buy.stripe.com/00wfZjeH76oVd5c2UvgnK07': 'til/stripe-family-lukas50/',
};

/** The button's href: the counted way, with Stripe's client_reference_id in the query so til.js can pass it on. */
export function payHref(stripeUrl, attr) {
  var base = String(stripeUrl || '').split('?')[0];
  var via = STRIPE_VIA[base];
  var ref = stripeClientReference(attr);
  if (via) return ref ? via + '?client_reference_id=' + encodeURIComponent(ref) : via;
  return withClientReference(stripeUrl, attr);
}
