const experiences = {
  children: { title: 'Gita for Children', kicker: 'For children', copy: 'A joyful nine-month journey of chanting, discovery and learning to use the Gita in everyday life.', modes: 'Guided learning', audience: 'Children and families', image: 'assets/images/experience-gita-for-children.jpg' },
  sara: { title: 'Gita Sāra', kicker: 'Everyday wisdom', copy: 'Selected shlokas that bring clarity to relationships, responsibilities, choices and the possibilities of everyday life.', modes: 'Guided and digital learning', audience: 'Adults and families', image: 'assets/images/experience-gita-sara.jpg' },
  yoga: { title: 'Gita Yoga', kicker: 'Chant and understand', copy: 'A structured journey through Gita chanting, accompanied by a brief meaning for every shloka.', modes: 'Guided learning', audience: 'Youth, adults and elders', image: 'assets/images/experience-gita-yoga.jpg' },
  purna: { title: 'Purna Yoga Darshana', kicker: 'Deep contemplation', copy: 'A deeper inquiry into the Gita through chanting, contemplation and the illumination of multiple viewpoints.', modes: 'Guided learning', audience: 'Committed adult learners', image: 'assets/images/experience-purna-yoga-darshana.jpg' },
};

const experienceDialog = document.querySelector('#experience-dialog');
document.querySelectorAll('[data-experience]').forEach(card => card.addEventListener('click', () => {
  const experience = experiences[card.dataset.experience];
  document.querySelector('#experience-dialog-image').src = experience.image;
  document.querySelector('#experience-dialog-image').alt = card.querySelector('img').alt;
  document.querySelector('#experience-dialog-kicker').textContent = experience.kicker;
  document.querySelector('#experience-dialog-title').textContent = experience.title;
  document.querySelector('#experience-dialog-copy').textContent = experience.copy;
  document.querySelector('#experience-dialog-modes').textContent = experience.modes;
  document.querySelector('#experience-dialog-audience').textContent = experience.audience;
  experienceDialog.showModal();
}));
document.querySelector('[data-close-experience]').addEventListener('click', () => experienceDialog.close());
experienceDialog.addEventListener('click', event => { if (event.target === experienceDialog) experienceDialog.close(); });

const registrationOverlay = document.querySelector('#registration-overlay');
const openRegistration = event => {
  event?.preventDefault();
  registrationOverlay.hidden = false;
  document.body.classList.add('registration-is-open');
  if (!history.state?.registrationOpen) history.pushState({ ...history.state, registrationOpen: true }, '');
  registrationOverlay.querySelector('input')?.focus();
};
const hideRegistration = () => {
  registrationOverlay.hidden = true;
  document.body.classList.remove('registration-is-open');
};
document.querySelectorAll('[data-open-registration]').forEach(link => link.addEventListener('click', openRegistration));
document.querySelector('#close-registration').addEventListener('click', () => {
  if (history.state?.registrationOpen) history.back(); else hideRegistration();
});
window.addEventListener('popstate', () => {
  if (!history.state?.registrationOpen) hideRegistration();
});

const flute = document.querySelector('.mygita-header-mark');
const playFlute = () => {
  flute.classList.remove('is-playing');
  void flute.offsetWidth;
  flute.classList.add('is-playing');
  window.setTimeout(() => flute.classList.remove('is-playing'), 850);
};
flute.addEventListener('click', playFlute);
