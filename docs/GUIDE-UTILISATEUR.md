# Guide de l'utilisateur

Une section par métier. Chaque personne voit uniquement les écrans de son rôle.

## Coupure du réseau (saisie hors ligne)

Si le serveur devient injoignable, certaines saisies sont **gardées sur le poste** puis renvoyées automatiquement au retour de la connexion : arrivée à l'accueil, tri et constantes, mesure de croissance, vaccination, allergie. Un bandeau jaune indique le nombre de saisies en attente (bouton *Envoyer maintenant*). L'heure réelle de saisie est conservée dans le dossier.

À savoir :
- Les saisies en attente ne partent que sous le compte de la personne qui les a saisies : elle doit être connectée.
- Le contenu en attente est chiffré sur le disque du poste. Si le poste n'a pas de coffre sécurisé (certains Linux), il reste en mémoire seulement : **ne fermez pas l'application** tant que le bandeau est affiché.
- Si le serveur refuse une saisie (donnée invalide, dossier disparu), elle apparaît dans « Refusé par le serveur, à vérifier » avec le numéro de dossier : il faut la ressaisir.
- **Non disponibles hors ligne** : création de dossier, consultation, prescription, délivrance, facturation et encaissement (risque de conflit, de stock ou d'argent), et la **lecture** de dossiers (rien n'est mis en cache sur le poste).

## Langue

L'interface existe en français et en anglais. Le sélecteur de langue est sur l'écran de connexion et dans la barre latérale ; le choix est mémorisé sur le poste. Les messages renvoyés par le serveur (erreurs de validation) et les données saisies (noms, motifs, notes) restent dans leur langue d'origine.

Pour ajouter ou corriger une traduction : `apps/desktop/src/lib/i18n/en/` (le texte français sert de clé) ; contrôle de couverture : `cd apps/backend && npx tsx ../../scripts/i18n/check-i18n.ts`.

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
- **Lits** : hospitaliser, transférer, faire sortir un enfant. À la sortie, indiquer l'**issue du séjour** (guéri, amélioré, référé, contre avis médical, décédé) et un résumé avec les consignes. Le **résumé de sortie** s'imprime ensuite depuis le dossier du patient (onglet *Hospitalisations*).
- **Administration des médicaments** (dossier patient, onglet *Hospitalisations*, séjour en cours — infirmière) : pour chaque ordonnance, *Donné* ou *Non donné* (le motif est obligatoire). L'heure et la personne sont tracées ; un double clic est refusé pendant 2 minutes. Le médecin consulte l'historique. Pour une ordonnance avec un nombre de prises par jour, un repère indique la prochaine prise, *À donner maintenant* ou *En retard* (intervalle régulier à partir de la dernière prise donnée ; repère simple à valider par le service).
- **Décès** : choisir l'issue « Décédé » à la sortie marque le dossier *Décédé* (l'enfant ne peut plus être ajouté à la file) et alimente la *Mortalité hospitalière* des statistiques. Seul un médecin peut l'enregistrer ; il peut indiquer la date et l'heure réelles du décès et confirme son choix. Un patient décédé ne peut plus être ajouté à la file, hospitalisé, consulté ni recevoir de rendez-vous. En cas d'erreur, un médecin peut utiliser *Corriger : le patient n'est pas décédé* dans le dossier (motif obligatoire, correction tracée dans le séjour).
- **Naissance** (dossier patient, onglet *Naissance*, infirmière ou médecin) : poids de naissance (g), âge gestationnel, Apgar à 1 et 5 minutes, mode d'accouchement. Une seule saisie par enfant. Des alertes signalent un faible poids (< 2500 g, < 1500 g), la prématurité (< 37 semaines) et un Apgar à 5 minutes < 7 (repères usuels, à faire valider par un pédiatre).
- **PTME — nourrisson exposé au VIH** (dossier patient, onglet *PTME*, infirmière ou médecin ; onglet invisible pour les autres rôles : donnée très sensible) : inscrire l'enfant de moins de 24 mois (statut de la mère, prophylaxie ARV du nourrisson), puis enregistrer le résultat de chaque dépistage : PCR à 6 semaines, contrôle à 9 mois, sérologie finale à 18 mois. Chaque jalon passe *À venir*, *À faire*, puis *En retard* (28 jours après l'échéance). Un résultat n'est accepté que dans les 14 jours précédant l'échéance du jalon ; la fin de suivi exige la PCR à 6 semaines et la sérologie finale négatives. Seul un médecin peut annuler un résultat saisi par erreur (motif obligatoire, l'ancien résultat est conservé comme annulé). Le journal d'audit n'indique pas le patient ni la nature des actes PTME, seulement qui et quand. Calendrier écrit de mémoire d'après les recommandations publiques de l'OMS : **à valider par le programme national**.
- **Vaccinations et croissance** : voir ci-dessous (dossier patient).

## Pour le médecin

1. *File active* → **Consulter** (ou *Consultations* puis choisir l'enfant).
2. Saisir le motif, les constantes (température, poids, taille, fréquences), les notes. *Enregistrer*.
3. Ensuite, sur la même page :
   - **Diagnostic** : choisir dans la liste CIM-10 ou saisir un diagnostic libre, *confirmé* ou *provisoire*. On peut en ajouter plusieurs.
   - **Demander un examen** : choisir dans le catalogue (NFS, hémoglobine, CRP, glycémie…) ou saisir librement. Le laboratoire le reçoit aussitôt. Cocher *Demande urgente* pour la placer en tête de la file du laboratoire.
   - **Demander une imagerie**.
   - **Référer vers une autre structure** (hôpital régional, CHU…) : destination, motif, résumé clinique, case *urgente*. La **fiche de référence** s'imprime ensuite depuis le dossier du patient (onglet *Consultations et prescriptions*), avec les diagnostics de la consultation.
   - **Prescrire** (durée du traitement facultative : elle clôt le repère de doses au bout de la cure) : choisir dans le formulaire de la pharmacie. Le logiciel avertit si l'enfant a une allergie connue au médicament ; il faut confirmer pour prescrire quand même. En renseignant la dose par prise (mg) et le nombre de prises par jour pour un médicament du formulaire, la dose quotidienne par kg est contrôlée d'après le dernier poids ; si elle dépasse le maximum usuel, ou si le poids est inconnu, une confirmation est demandée et tracée. Le contrôle vérifie aussi un plafond absolu par jour (grands enfants), les contre-indications d'âge ou de poids (ibuprofène avant 3 mois ou sous 5 kg) et un poids enregistré depuis plus de 30 jours. Si une allergie a été notée hors ligne et n'est pas encore envoyée, une confirmation est demandée. Les maxima sont à faire valider par le pharmacien responsable.
4. Les résultats reviennent dans le **Dossier patient** (onglet *Examens*), avec un drapeau ↑ ou ↓ quand la valeur sort de la plage de référence.

Le médecin voit aussi son agenda du jour dans *Rendez-vous* et clôt un rendez-vous (*Terminer*) une fois l'enfant vu.

## Dans le dossier patient

Onglets : Informations, Consultations et prescriptions, Hospitalisations, Examens, Vaccinations, Croissance, Allergies.

- **Vaccinations** : le *calendrier recommandé* montre chaque dose avec son état (fait, à faire, en retard, à venir). Cliquer une dose non faite préremplit la saisie ; indiquer la date d'administration. *Imprimer le carnet*.
- **Croissance** : poids, taille, périmètre crânien et **périmètre brachial** (en mm). Pour un enfant de 6 à 59 mois, le périmètre brachial est classé automatiquement : moins de 115 mm = malnutrition aiguë sévère, de 115 à 124 mm = modérée, 125 mm et plus = normal. Hors de cette tranche d'âge, la valeur est enregistrée sans classement. (Les courbes de référence de l'OMS ne sont pas encore intégrées.)
- **Ordonnance** et **comptes rendus d'examens** : boutons *Imprimer* (ou enregistrer en PDF).

## Laboratoire (technicien)

1. *Laboratoire* → choisir une demande dans la liste (les demandes marquées *Urgent* sont en tête).
2. Si l'examen est dans le catalogue, les analyses (ex. hémoglobine, leucocytes, plaquettes, hématocrite pour une NFS) sont déjà listées avec leur unité. Saisir la **valeur**, et si besoin les **bornes de référence** : un badge *Élevé / Bas / Normal* s'affiche tout de suite. Les bornes sont **proposées d'après l'âge et le sexe** de l'enfant (modifiables) ; une valeur franchement anormale s'affiche en *Critique* (rouge plein) et reste marquée ainsi dans le dossier. Ces valeurs sont à faire valider par le biologiste responsable, et à remplacer par les intervalles de votre laboratoire. Les analyses laissées vides sont ignorées.
3. *Valider et envoyer* : le médecin voit le résultat dans le dossier.

Un résultat qualitatif (« Positif ») se saisit simplement en texte.

## Radiologie

*Radiologie* → choisir la demande, saisir le compte rendu, envoyer.

## Pharmacie

- **Ordonnances à délivrer** : choisir l'ordonnance, l'article du formulaire délivré et la quantité. Le logiciel refuse une quantité supérieure au stock ; si l'article choisi ne correspond pas au médicament prescrit, une confirmation est demandée.
- **Stock** : quantités utilisables ; les articles sous leur seuil sont signalés *À réapprovisionner*. Les lots les plus proches de leur péremption sortent en premier. Un lot périmé n'est plus compté dans le stock utilisable et s'affiche *périmé, à retirer* ; les lots qui périment sous 90 jours sont signalés.
- **Réception** : enregistrer une livraison (article, quantité, numéro de lot, péremption). Un lot déjà périmé est refusé.

## Caisse

- **À facturer** : consultations récentes pas encore facturées. Indiquer au besoin l'assureur et le taux de prise en charge, puis *Facturer* : la facture reprend la consultation, les examens et les médicaments délivrés. Si des examens ou des médicaments s'ajoutent *après* la facture, la consultation revient dans la liste avec la mention *Complément* : *Facturer le complément* crée une seconde facture avec les seuls éléments non facturés. Une facture entièrement prise en charge par l'assureur (100 %) est soldée d'emblée.
- **Factures** : choisir une facture, saisir le montant et le mode de paiement (espèces, mobile money, carte), *Encaisser*. Un paiement partiel est possible ; la facture est *soldée* quand tout est payé. *Imprimer la facture* ou *le reçu*.

## Surveillance épidémiologique

*Surveillance* (médecin, direction, administration technique) : cas des maladies prioritaires par semaine ISO (lundi au dimanche), d'après les diagnostics CIM-10 saisis en consultation. Pour chaque maladie : cas, cas confirmés, moins de 5 ans, et moyenne des 4 semaines précédentes. Une **alerte immédiate** s'affiche dès un cas d'une maladie à déclaration immédiate (choléra, rougeole, poliomyélite, méningite…), avec l'âge et le sexe du cas (jamais l'identité). Une **alerte de seuil** s'affiche pour une maladie hebdomadaire avec au moins 5 cas et au moins le double de la moyenne précédente. *Exporter en CSV* pour le rapport au district.

Un même enfant n'est compté qu'une fois par maladie et par semaine. Les semaines suivent l'heure de l'établissement (`FACILITY_UTC_OFFSET_MINUTES`). Les diagnostics sans code CIM-10 ne sont pas comptés : leur nombre est signalé à l'écran.

Cette liste de maladies et ces seuils sont une base de départ : ils doivent être adaptés à la liste nationale de surveillance (IDSR) de votre pays avant usage.

## Direction

*Tableau de bord*, *Statistiques* (activité, occupation des lits, charge par praticien), *Rapports* (indicateurs mensuels, export CSV et fichier DHIS2), *Facturation* (chiffres du jour, tarifs), *Journal d'audit*.

## Administration technique

*Comptes*, *Supervision* (état du serveur), *Flux FHIR*, *Rapports* (correspondance DHIS2), *Journal d'audit*. Voir [ADMINISTRATION.md](ADMINISTRATION.md).
