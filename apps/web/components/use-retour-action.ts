"use client";

import { startTransition, useActionState, useEffect, type FormEvent } from "react";
import { toast } from "sonner";
import type { EtatAction } from "@/lib/types";

type Succes = Extract<NonNullable<EtatAction>, { ok: true }>;

/**
 * Branche un formulaire sur une Server Action : état en cours (pour l'overlay)
 * et message une fois la réponse arrivée.
 *
 * Soumission par `onSubmit` + `startTransition`, et non par `<form action>` :
 * React 19 VIDE les champs d'un `<form action>` à la fin de chaque action,
 * erreur comprise. Une faute de saisie sur le formulaire de course effacerait
 * alors tout ce que le client a tapé.
 */
export function useFormulaireAction(
  actionServeur: (etat: EtatAction, formData: FormData) => Promise<EtatAction>,
  surSucces?: (etat: Succes) => void,
) {
  const [etat, action, enCours] = useActionState(actionServeur, null);
  useRetourAction(etat, surSucces);

  function soumettre(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    const formData = new FormData(evenement.currentTarget);
    startTransition(() => action(formData));
  }

  return { soumettre, enCours };
}

/**
 * Affiche le message d'une Server Action une fois sa réponse arrivée.
 *
 * Chaque soumission rend un NOUVEL objet d'état, donc l'effet se déclenche
 * une fois par réponse, même quand deux réponses portent le même message.
 */
export function useRetourAction(etat: EtatAction, surSucces?: (etat: Succes) => void) {
  useEffect(() => {
    if (!etat) return;
    if (!etat.ok) {
      toast.error(etat.message);
      return;
    }
    if (etat.avertissement) toast.warning(etat.message, { duration: 8000 });
    else toast.success(etat.message);
    surSucces?.(etat);
    // `surSucces` est recréé à chaque rendu : seul un nouvel état doit
    // redéclencher le message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etat]);
}
