# Guide de l'utilisateur

Une section par métier. Chaque personne voit uniquement les écrans de son rôle.

## Se connecter

Saisir son identifiant et son mot de passe. Après 8 heures, ou si le compte est désactivé, il faut se reconnecter. Le mot de passe se change dans **Paramètres**, la photo et les coordonnées dans **Mon profil**.

## À l'accueil (réceptionniste)

**Un nouvel enfant** — écran *Admission* : prénom, nom, date de naissance (AAAA-MM-JJ), sexe et coordonnées du tuteur. Le dossier reçoit un **numéro** du type `PX-001401` à donner à la famille ; l'enfant entre automatiquement dans la file d'attente du jour.

**Un enfant déjà connu** — écran *File active* : chercher l'enfant par son nom ou son numéro de dossier, puis *Ajouter à la file*. Un enfant ne peut pas être ajouté deux fois le même jour.

**Rendez-vous** — écran *Rendez-vous* : choisir l'enfant, le médecin, le jour, un créneau libre et le motif, puis *Réserver*. Le jour du rendez-vous, cliquer *Arrivé* à l'arrivée (ou *Absent*, *Annuler*).

## Pour l'infirmière

- **Trier les arrivées** (*File active*) : cliquer le point rouge (urgence), orange (prioritaire) ou vert (non urgent) à côté du patient. La file passe les urgences d'abord, puis les prioritaires, puis les patients pas encore triés, puis les non urgents. La logique est celle du tri ETAT de l'OMS.
- **Constantes au tri** (*File active*, bouton « Constantes ») : saisir température, fréquences cardiaque et respiratoire, saturation en oxygène, puis choisir la catégorie de tri. Les valeurs sont résumées dans la file ; la saturation sous 90 % et une température à 39,5 °C ou plus (ou sous 35,5 °C) s'affichent en rouge. Ces seuils sont prudents et indépendants de l'âge : à faire valider par un pédiatre.
- **Patient parti sans consultation** (*File active*, bouton « Parti ») : retire le patient de la file sans le compter comme consultation. Le temps d'attente s'affiche pour chaque patient en attente.
- **Lits** : hospitaliser, transférer, faire sortir un enfant.
- **Vaccinations et croissance** : voir ci-dessous (dossier patient).

## Pour le médecin

1. *File active* → **Consulter** (ou *Consultations* puis choisir l'enfant).
2. Saisir le motif, les constantes (température, poids, taille, fréquences), les notes. *Enregistrer*.
3. Ensuite, sur la même page :
   - **Diagnostic** : choisir dans la liste CIM-10 ou saisir un diagnostic libre, *confirmé* ou *provisoire*. On peut en ajouter plusieurs.
   - **Demander un examen** : choisir dans le catalogue (NFS, hémoglobine, CRP, glycémie…) ou saisir librement. Le laboratoire le reçoit aussitôt.
   - **Demander une imagerie**.
   - **Référer vers une autre structure** (hôpital régional, CHU…) : destination, motif, résumé clinique, case *urgente*. La **fiche de référence** s'imprime ensuite depuis le dossier du patient (onglet *Consultations et prescriptions*), avec les diagnostics de la consultation.
   - **Prescrire** : choisir dans le formulaire de la pharmacie. Le logiciel avertit si l'enfant a une allergie connue au médicament ; il faut confirmer pour prescrire quand même. En renseignant la dose par prise (mg) et le nombre de prises par jour pour un médicament du formulaire, la dose quotidienne par kg est contrôlée d'après le dernier poids ; si elle dépasse le maximum usuel, ou si le poids est inconnu, une confirmation est demandée et tracée. Les maxima sont à faire valider par le pharmacien responsable.
4. Les résultats reviennent dans le **Dossier patient** (onglet *Examens*), avec un drapeau ↑ ou ↓ quand la valeur sort de la plage de référence.

Le médecin voit aussi son agenda du jour dans *Rendez-vous* et clôt un rendez-vous (*Terminer*) une fois l'enfant vu.

## Dans le dossier patient

Onglets : Informations, Consultations et prescriptions, Hospitalisations, Examens, Vaccinations, Croissance, Allergies.

- **Vaccinations** : le *calendrier recommandé* montre chaque dose avec son état (fait, à faire, en retard, à venir). Cliquer une dose non faite préremplit la saisie ; indiquer la date d'administration. *Imprimer le carnet*.
- **Croissance** : poids, taille, périmètre crânien et **périmètre brachial** (en mm). Pour un enfant de 6 à 59 mois, le périmètre brachial est classé automatiquement : moins de 115 mm = malnutrition aiguë sévère, de 115 à 124 mm = modérée, 125 mm et plus = normal. Hors de cette tranche d'âge, la valeur est enregistrée sans classement. (Les courbes de référence de l'OMS ne sont pas encore intégrées.)
- **Ordonnance** et **comptes rendus d'examens** : boutons *Imprimer* (ou enregistrer en PDF).

## Laboratoire (technicien)

1. *Laboratoire* → choisir une demande dans la liste.
2. Si l'examen est dans le catalogue, les analyses (ex. hémoglobine, leucocytes, plaquettes, hématocrite pour une NFS) sont déjà listées avec leur unité. Saisir la **valeur**, et si besoin les **bornes de référence** : un badge *Élevé / Bas / Normal* s'affiche tout de suite. Les analyses laissées vides sont ignorées.
3. *Valider et envoyer* : le médecin voit le résultat dans le dossier.

Un résultat qualitatif (« Positif ») se saisit simplement en texte.

## Radiologie

*Radiologie* → choisir la demande, saisir le compte rendu, envoyer.

## Pharmacie

- **Ordonnances à délivrer** : choisir l'ordonnance, l'article du formulaire délivré et la quantité. Le logiciel refuse une quantité supérieure au stock.
- **Stock** : quantités en stock ; les articles sous leur seuil sont signalés *À réapprovisionner*.
- **Réception** : enregistrer une livraison (article, quantité, numéro de lot, péremption).

## Caisse

- **À facturer** : consultations récentes pas encore facturées. Indiquer au besoin l'assureur et le taux de prise en charge, puis *Facturer* : la facture reprend la consultation, les examens et les médicaments délivrés.
- **Factures** : choisir une facture, saisir le montant et le mode de paiement (espèces, mobile money, carte), *Encaisser*. Un paiement partiel est possible ; la facture est *soldée* quand tout est payé. *Imprimer la facture* ou *le reçu*.

## Direction

*Tableau de bord*, *Statistiques* (activité, occupation des lits, charge par praticien), *Rapports* (indicateurs mensuels, export CSV et fichier DHIS2), *Facturation* (chiffres du jour, tarifs), *Journal d'audit*.

## Administration technique

*Comptes*, *Supervision* (état du serveur), *Flux FHIR*, *Rapports* (correspondance DHIS2), *Journal d'audit*. Voir [ADMINISTRATION.md](ADMINISTRATION.md).
