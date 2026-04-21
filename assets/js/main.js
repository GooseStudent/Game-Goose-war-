// ==========================================
// 1. ГЛОБАЛЬНОЕ СОСТОЯНИЕ ИГРЫ (STATE)
// ==========================================

let playerHP = 50;
let enemyHP = 50;
let gameStarted = false;

let draggedCard = null;
let shiftX = 0;
let shiftY = 0;
let isDragging = false;


// ==========================================
// 2. БАЗА ДАННЫХ КАРТ (DATA)
// ==========================================

const allCards = [
  {
    name: "Гусь-с-топором",
    attack: 2,
    hp: 2,
    type: "melee",
    image: "./assets/images/goose-axe.webp",
    abilities: ["onDeploy:damageRandomEnemy:1"]
  },
  {
    name: "Гусь-лучник",
    attack: 2,
    hp: 1,
    type: "mid",
    image: "./assets/images/goose-archer.webp",
    abilities: ["onDeploy:damageAllEnemies:1"]
  },
  {
    name: "Гусь-маг",
    attack: 2,
    hp: 2,
    type: "mid",
    image: "./assets/images/goose-mag.webp",
    abilities: ["onDeploy:healRandomAlly:2"]
  },
  {
    name: "Гусь-на-катапульте",
    attack: 5,
    hp: 3,
    type: "ranged",
    image: "./assets/images/goose-catapult.webp",
    abilities: ["onTurnEnd:damageEnemyRow:1:ranged"]
  },
  {
    name: "Ленивый крендель",
    attack: 0,
    hp: 5,
    type: "melee",
    image: "./assets/images/lezy-crendel.webp",
    abilities: ["onDeploy:drawCard:1", "onDeath:damageAll:2"]
  },
];


// ==========================================
// 3. СИСТЕМА СПОСОБНОСТЕЙ (ABILITIES)
// ==========================================

function parseAbility(abilityStr) {
  const parts = abilityStr.split(':');
  return {
    trigger: parts[0],
    effect: parts[1],
    value: parts[2] ? parseFloat(parts[2]) : 0,
    target: parts[3] || null
  };
}

// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ПОЛУЧЕНИЯ КАРТ (ОБНОВЛЕННЫЕ)
function getAllEnemyCards() {
  const rows = document.querySelectorAll('.enemy .row .row-cards');
  const cards = [];
  rows.forEach(row => {
    cards.push(...Array.from(row.querySelectorAll('.card:not(.dead)')));
  });
  return cards;
}

function getAllPlayerCards() {
  const rows = document.querySelectorAll('.player .row .row-cards');
  const cards = [];
  rows.forEach(row => {
    cards.push(...Array.from(row.querySelectorAll('.card:not(.dead)')));
  });
  return cards;
}

function getAllCardsOnBoard() {
  return [...getAllEnemyCards(), ...getAllPlayerCards()];
}

function getEnemyCardsInRow(rowType) {
  const row = document.querySelector(`.enemy .row[data-row="${rowType}"] .row-cards`);
  return row ? Array.from(row.querySelectorAll('.card:not(.dead)')) : [];
}

function getOriginalHp(card) {
  return card.dataset.maxHp ? Number(card.dataset.maxHp) : Number(card.dataset.hp);
}

const abilityEffects = {
  damageRandomEnemy: (sourceCard, value, context) => {
    const enemyCards = getAllEnemyCards();
    if (enemyCards.length === 0) return;
    const target = enemyCards[Math.floor(Math.random() * enemyCards.length)];
    const died = dealDamage(target, value);
    if (died) {
      triggerCardAbility(target, 'onDeath', context);
    }
    showAbilityEffect(target, `-${value}❤️`, 'damage');
  },
  
  damageAllEnemies: (sourceCard, value, context) => {
    const enemyCards = getAllEnemyCards();
    enemyCards.forEach(enemy => {
      const died = dealDamage(enemy, value);
      if (died) {
        triggerCardAbility(enemy, 'onDeath', context);
      }
    });
    showAbilityEffect(null, `All enemies -${value}❤️`, 'damage');
  },
  
  healRandomAlly: (sourceCard, value, context) => {
    const allyCards = getAllPlayerCards();
    if (allyCards.length === 0) return;
    const target = allyCards[Math.floor(Math.random() * allyCards.length)];
    const currentHp = Number(target.dataset.hp);
    target.dataset.hp = Math.min(currentHp + value, getOriginalHp(target));
    showAbilityEffect(target, `+${value}❤️`, 'heal');
  },
  
  drawCard: (sourceCard, value, context) => {
    for (let i = 0; i < value; i++) {
      addCardToHandAnimated();
    }
    showAbilityEffect(null, `Draw ${value} card(s)`, 'draw');
  },
  
  damageAll: (sourceCard, value, context) => {
    const allCards = getAllCardsOnBoard();
    allCards.forEach(card => {
      const died = dealDamage(card, value);
      if (died && card !== sourceCard) {
        triggerCardAbility(card, 'onDeath', context);
      }
    });
  },
  
  damageEnemyRow: (sourceCard, value, targetRow, context) => {
    const enemyCards = getEnemyCardsInRow(targetRow);
    enemyCards.forEach(card => {
      const died = dealDamage(card, value);
      if (died) {
        triggerCardAbility(card, 'onDeath', context);
      }
    });
  }
};

function triggerCardAbility(card, triggerType, context) {
  if (!card || !card.dataset.abilities) return;
  const abilities = JSON.parse(card.dataset.abilities);
  abilities.forEach(abilityStr => {
    const ability = parseAbility(abilityStr);
    if (ability.trigger === triggerType) {
      const effectFn = abilityEffects[ability.effect];
      if (effectFn) {
        effectFn(card, ability.value, context, ability.target);
      }
    }
  });
}

function showAbilityEffect(target, text, type) {
  const div = document.createElement('div');
  const displayText = String(text || '');
  div.textContent = displayText;
  div.style.position = 'absolute';
  div.style.fontSize = '20px';
  div.style.fontWeight = 'bold';
  div.style.pointerEvents = 'none';
  div.style.zIndex = '2000';
  
  if (type === 'damage') {
    div.style.color = 'red';
    div.style.textShadow = '0 0 3px black';
  } else if (type === 'heal') {
    div.style.color = 'lightgreen';
    div.style.textShadow = '0 0 3px darkgreen';
  } else {
    div.style.color = 'gold';
  }
  
  if (target && target.getBoundingClientRect) {
    const rect = target.getBoundingClientRect();
    div.style.left = rect.left + rect.width/2 - 20 + 'px';
    div.style.top = rect.top - 30 + 'px';
  } else {
    div.style.left = '50%';
    div.style.top = '50%';
    div.style.transform = 'translate(-50%, -50%)';
  }
  
  document.body.appendChild(div);
  setTimeout(() => {
    div.style.transition = 'opacity 0.5s';
    div.style.opacity = '0';
    setTimeout(() => div.remove(), 500);
  }, 800);
}


// ==========================================
// 4. УПРАВЛЕНИЕ КАРТАМИ И РУКОЙ (CARDS & HAND)
// ==========================================

function getRandomCard() {
  const card = allCards[Math.floor(Math.random() * allCards.length)];
  return { ...card };
}

function createCard(cardData) {
  const card = document.createElement("div");
  card.classList.add("card", cardData.type);
  card.dataset.attack = cardData.attack;
  card.dataset.hp = cardData.hp;
  card.dataset.maxHp = cardData.hp;
  card.dataset.type = cardData.type;
  card.dataset.name = cardData.name;
  card.dataset.abilities = JSON.stringify(cardData.abilities || []);
  card.style.background = `url("${cardData.image}") center/cover no-repeat`;
  
  card.removeEventListener("mousedown", startDrag);
  card.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    startDrag(card, e);
  });
  
  return card;
}

function createHand() {
  const hand = document.getElementById("hand");
  if (!hand) return;
  hand.innerHTML = "";
  for (let i = 0; i < 3; i++) {
    hand.appendChild(createCard(getRandomCard()));
  }
}

function addCardToHandAnimated() {
  const hand = document.getElementById("hand");
  const deck = document.getElementById("deck");
  if (!hand || !deck) return;
  
  const cardData = getRandomCard();
  const realCard = createCard(cardData);
  realCard.style.opacity = "0";
  realCard.style.transform = "scale(0.5)";
  hand.appendChild(realCard);
  const deckRect = deck.getBoundingClientRect();
  const cardRect = realCard.getBoundingClientRect();
  const deltaX = deckRect.left - cardRect.left;
  const deltaY = deckRect.top - cardRect.top;
  realCard.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(0.5)`;
  realCard.style.opacity = "0.5";
  realCard.offsetWidth;
  realCard.style.transition = "transform 0.5s ease, opacity 0.5s ease";
  realCard.style.transform = "translate(0, 0) scale(1)";
  realCard.style.opacity = "1";
}

// ==========================================
// 5. БОЕВАЯ СИСТЕМА (COMBAT)
// ==========================================

// Функция нанесения урона карте (нужна для способностей)
function dealDamage(card, damage) {
  if (!card || card.classList.contains('dead')) return false;
  
  let hp = Number(card.dataset.hp) - damage;
  
  if (hp <= 0) {
    card.classList.add("dead");
    card.style.transition = 'all 0.2s ease';
    card.style.opacity = '0';
    card.style.transform = 'scale(0.5)';
    
    triggerCardAbility(card, 'onDeath', {});
    
    setTimeout(() => {
      if (card.parentNode) card.remove();
      updateRowStats();
    }, 250);
    return true;
  } else {
    card.dataset.hp = hp;
    updateRowStats();
    return false;
  }
}

async function animateAttack(card) {
  if (!card || card.classList.contains('dead')) return Promise.resolve();
  
  return new Promise(resolve => {
    const originalTransform = card.style.transform;
    const originalFilter = card.style.filter;
    const originalTransition = card.style.transition;
    
    card.style.transition = 'all 0.1s ease';
    card.style.transform = 'translateY(-10px) scale(1.15)';
    card.style.filter = 'brightness(1.3) drop-shadow(0 0 5px gold)';
    
    setTimeout(() => {
      card.style.transform = 'translateY(0) scale(1)';
      card.style.filter = 'brightness(1) drop-shadow(0 0 0px)';
      
      setTimeout(() => {
        card.style.transition = originalTransition;
        resolve();
      }, 100);
    }, 100);
  });
}

async function showDamageOnCard(card, damage) {
  if (!card || card.classList.contains('dead')) return;
  
  card.style.transition = 'all 0.1s ease';
  card.style.filter = 'brightness(0.5) drop-shadow(0 0 5px red)';
  card.style.transform = 'translateX(-3px)';
  
  const div = document.createElement('div');
  div.textContent = `-${damage}`;
  div.style.position = 'absolute';
  div.style.fontSize = '20px';
  div.style.fontWeight = 'bold';
  div.style.color = 'red';
  div.style.textShadow = '0 0 3px black';
  div.style.pointerEvents = 'none';
  div.style.zIndex = '2000';
  
  const rect = card.getBoundingClientRect();
  div.style.left = rect.left + rect.width/2 - 15 + 'px';
  div.style.top = rect.top - 20 + 'px';
  
  document.body.appendChild(div);
  
  let y = 0;
  const animate = () => {
    y -= 2;
    div.style.transform = `translateY(${y}px)`;
    if (y > -40) {
      requestAnimationFrame(animate);
    } else {
      div.style.opacity = '0';
      setTimeout(() => div.remove(), 200);
    }
  };
  requestAnimationFrame(animate);
  
  setTimeout(() => {
    if (card && !card.classList.contains('dead')) {
      card.style.filter = '';
      card.style.transform = '';
    }
  }, 150);
  
  await delay(200);
}

async function showDamageNumber(target, damage, targetType) {
  const div = document.createElement('div');
  div.textContent = `-${damage} ❤️`;
  div.style.position = 'fixed';
  div.style.fontSize = '28px';
  div.style.fontWeight = 'bold';
  div.style.color = 'red';
  div.style.textShadow = '0 0 3px black';
  div.style.pointerEvents = 'none';
  div.style.zIndex = '2000';
  
  if (targetType === 'player') {
    const playerHPspan = document.getElementById('playerHP');
    const rect = playerHPspan.getBoundingClientRect();
    div.style.left = rect.left - 30 + 'px';
    div.style.top = rect.top - 20 + 'px';
  } else {
    const enemyHPspan = document.getElementById('enemyHP');
    const rect = enemyHPspan.getBoundingClientRect();
    div.style.left = rect.left - 30 + 'px';
    div.style.top = rect.top - 20 + 'px';
  }
  
  document.body.appendChild(div);
  
  let y = 0;
  const animate = () => {
    y -= 2;
    div.style.transform = `translateY(${y}px)`;
    if (y > -50) {
      requestAnimationFrame(animate);
    } else {
      div.style.opacity = '0';
      setTimeout(() => div.remove(), 200);
    }
  };
  requestAnimationFrame(animate);
  
  await delay(300);
}

async function resolveCombat() {
  const order = ["ranged", "mid", "melee"];
  
  for (let type of order) {
    const pRowContainer = document.querySelector(`.player .row[data-row="${type}"] .row-cards`);
    const eRowContainer = document.querySelector(`.enemy .row[data-row="${type}"] .row-cards`);
    
    if (!pRowContainer || !eRowContainer) continue;
    
    // Получаем ВСЕ карты в ряду (включая с атакой 0)
    let pCards = Array.from(pRowContainer.querySelectorAll('.card:not(.dead)'));
    let eCards = Array.from(eRowContainer.querySelectorAll('.card:not(.dead)'));
    
    // Сортируем карты по возрастанию HP (чтобы сначала бить по слабым)
    pCards.sort((a, b) => Number(a.dataset.hp) - Number(b.dataset.hp));
    eCards.sort((a, b) => Number(a.dataset.hp) - Number(b.dataset.hp));
    
    // Собираем всех бойцов (включая с атакой 0, но они не будут атаковать)
    let fighters = [];
    
    pCards.forEach(card => {
      fighters.push({
        card: card,
        side: 'player',
        attack: Number(card.dataset.attack),
        hp: Number(card.dataset.hp)
      });
    });
    
    eCards.forEach(card => {
      fighters.push({
        card: card,
        side: 'enemy',
        attack: Number(card.dataset.attack),
        hp: Number(card.dataset.hp)
      });
    });
    
    if (fighters.length === 0) continue;
    
    // Перемешиваем бойцов для случайного порядка атаки
    for (let i = fighters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [fighters[i], fighters[j]] = [fighters[j], fighters[i]];
    }
    
    // Каждый боец атакует 1 раз
    for (let attacker of fighters) {
      if (attacker.hp <= 0) continue;
      if (attacker.attack <= 0) continue; // Карты с атакой 0 пропускают ход
      
      await animateAttack(attacker.card);
      
      // Находим ВСЕХ живых врагов в этом ряду
      let enemies = [];
      if (attacker.side === 'player') {
        enemies = [...eCards]; // Копируем массив
      } else {
        enemies = [...pCards];
      }
      
      // Фильтруем только живых
      enemies = enemies.filter(card => {
        const isAlive = !card.classList.contains('dead');
        const hp = Number(card.dataset.hp);
        return isAlive && hp > 0;
      });
      
      let remainingDamage = attacker.attack;
      
      // Пока есть урон и есть враги - бьём
      while (remainingDamage > 0 && enemies.length > 0) {
        // Берём первого врага в очереди (самого слабого, т.к. отсортировали)
        const target = enemies[0];
        const currentHp = Number(target.dataset.hp);
        
        if (remainingDamage >= currentHp) {
          // Убиваем врага
          remainingDamage -= currentHp;
          await showDamageOnCard(target, currentHp);
          
          // Помечаем как мёртвого
          target.classList.add('dead');
          target.style.transition = 'all 0.2s ease';
          target.style.opacity = '0';
          target.style.transform = 'scale(0.5)';
          
          triggerCardAbility(target, 'onDeath', {});
          
          // Удаляем из массива enemies
          enemies.shift();
          
          // Удаляем из родительского контейнера после анимации
          setTimeout(() => {
            if (target.parentNode) target.remove();
            updateRowStats();
          }, 250);
          
        } else {
          // Наносим частичный урон
          const newHp = currentHp - remainingDamage;
          target.dataset.hp = newHp;
          await showDamageOnCard(target, remainingDamage);
          remainingDamage = 0;
          updateRowStats();
        }
        
        await delay(200);
      }
      
      // Если урон остался и врагов больше нет - бьём героя
      if (remainingDamage > 0) {
        if (attacker.side === 'player') {
          enemyHP -= remainingDamage;
          await showDamageNumber(null, remainingDamage, 'enemy');
        } else {
          playerHP -= remainingDamage;
          await showDamageNumber(null, remainingDamage, 'player');
        }
        updateHP();
      }
      
      await delay(100);
      
      // Проверка конца игры
      if (playerHP <= 0 || enemyHP <= 0) {
        checkGameOver();
        return;
      }
      
      // Обновляем списки карт для следующих атак
      if (attacker.side === 'player') {
        eCards = Array.from(eRowContainer.querySelectorAll('.card:not(.dead)'));
        eCards.sort((a, b) => Number(a.dataset.hp) - Number(b.dataset.hp));
      } else {
        pCards = Array.from(pRowContainer.querySelectorAll('.card:not(.dead)'));
        pCards.sort((a, b) => Number(a.dataset.hp) - Number(b.dataset.hp));
      }
    }
  }
  
  // Триггерим способности в конце хода
  const allCardsList = [...getAllPlayerCards(), ...getAllEnemyCards()];
  allCardsList.forEach(card => {
    if (card && !card.classList.contains('dead')) {
      triggerCardAbility(card, 'onTurnEnd', {});
    }
  });
  
  updateRowStats();
  updateHP();
  checkGameOver();
}


// ==========================================
// 6. ИСКУССТВЕННЫЙ ИНТЕЛЛЕКТ ВРАГА (ENEMY AI)
// ==========================================

function enemyTurn() {
  const types = ["melee", "mid", "ranged"];
  
  const availableRows = types.filter(type => {
    const rowContainer = document.querySelector(`.enemy .row[data-row="${type}"] .row-cards`);
    if (!rowContainer) return false;
    const cardsInRow = rowContainer.querySelectorAll('.card:not(.dead)');
    return cardsInRow.length < 3;
  });
  
  if (availableRows.length === 0) return;
  
  const targetType = availableRows[Math.floor(Math.random() * availableRows.length)];
  const availableCards = allCards.filter(c => c.type === targetType);
  if (availableCards.length === 0) return;
  
  const cardData = { ...availableCards[Math.floor(Math.random() * availableCards.length)] };
  const card = createCard(cardData);
  const rowContainer = document.querySelector(`.enemy .row[data-row="${targetType}"] .row-cards`);
  if (rowContainer) {
    rowContainer.appendChild(card);
    updateRowStats();
  }
  
  card.style.opacity = "0";
  card.style.transform = "scale(0.5)";
  setTimeout(() => {
    card.style.transition = "all 0.2s ease";
    card.style.opacity = "1";
    card.style.transform = "scale(1)";
  }, 10);
}


// ==========================================
// 7. UI И ОБНОВЛЕНИЯ (UI & UPDATES)
// ==========================================

function updateHP() {
  const playerHPElem = document.getElementById("playerHP");
  const enemyHPElem = document.getElementById("enemyHP");
  if (playerHPElem) playerHPElem.textContent = playerHP;
  if (enemyHPElem) enemyHPElem.textContent = enemyHP;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function showTemporaryMessage(text, type = "error") {
  const msg = document.createElement("div");
  msg.textContent = text;
  msg.style.position = "fixed";
  msg.style.bottom = "100px";
  msg.style.left = "50%";
  msg.style.transform = "translateX(-50%)";
  msg.style.backgroundColor = type === "error" ? "#dc143c" : "#4CAF50";
  msg.style.color = "white";
  msg.style.padding = "10px 20px";
  msg.style.borderRadius = "8px";
  msg.style.zIndex = "10000";
  msg.style.fontWeight = "bold";
  msg.style.border = "2px solid gold";
  document.body.appendChild(msg);
  setTimeout(() => {
    msg.style.opacity = "0";
    msg.style.transition = "opacity 0.3s";
    setTimeout(() => msg.remove(), 300);
  }, 1500);
}


// ==========================================
// 8. УПРАВЛЕНИЕ ИГРОЙ (GAME FLOW)
// ==========================================

function checkGameOver() {
  if (playerHP <= 0) {
    showGameOver("Поражение");
    return true;
  }
  if (enemyHP <= 0) {
    showGameOver("Победа");
    return true;
  }
  return false;
}

function showGameOver(text) {
  const screen = document.getElementById("gameOverScreen");
  const label = document.getElementById("gameOverText");
  if (screen && label) {
    label.textContent = text;
    screen.classList.remove("hidden");
  }
}

function restartGame() {
  playerHP = 50;
  enemyHP = 50;
  updateHP();
  document.querySelectorAll(".row-cards").forEach(row => {
    row.innerHTML = "";
  });
  
  const hand = document.getElementById("hand");
  if (hand) hand.innerHTML = "";
  const gameOverScreen = document.getElementById("gameOverScreen");
  if (gameOverScreen) gameOverScreen.classList.add("hidden");
  createHand();
  enemyTurn();
  enemyTurn();
  updateRowStats();
}

function setupTurnButton() {
  const endTurnBtn = document.getElementById("endTurn");
  if (endTurnBtn) {
    endTurnBtn.onclick = async () => {
      await resolveCombat();
      if (playerHP > 0 && enemyHP > 0) {
        enemyTurn();
        addCardToHandAnimated();
      }
    };
  }
}


// ==========================================
// 9. СИСТЕМА DRAG & DROP (ПЕРЕТАСКИВАНИЕ)
// ==========================================

function startDrag(card, e) {
  if (!card || !card.parentNode) return;
  
  e.preventDefault();
  e.stopPropagation();
  
  isDragging = true;
  draggedCard = card;
  draggedCard.originalParent = card.parentNode;
  draggedCard._originalIndex = Array.from(card.parentNode.children).indexOf(card);
  
  const rect = card.getBoundingClientRect();
  shiftX = e.clientX - rect.left;
  shiftY = e.clientY - rect.top;
  
  card.classList.add("dragging");
  card.style.position = "fixed";
  card.style.zIndex = "9999";
  card.style.width = rect.width + "px";
  card.style.height = rect.height + "px";
  card.style.left = rect.left + "px";
  card.style.top = rect.top + "px";
  card.style.margin = "0";
  card.style.cursor = "grabbing";
  card.style.pointerEvents = "none";
  
  document.body.appendChild(card);
  moveAt(e.clientX, e.clientY);
  
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
}

function moveAt(clientX, clientY) {
  if (!draggedCard) return;
  draggedCard.style.left = (clientX - shiftX) + "px";
  draggedCard.style.top = (clientY - shiftY) + "px";
}

function onMouseMove(e) {
  if (!draggedCard || !isDragging) return;
  e.preventDefault();
  moveAt(e.clientX, e.clientY);
  
  const trashBin = document.querySelector(".trash-bin");
  if (trashBin) {
    const rect = trashBin.getBoundingClientRect();
    const isOver = e.clientX >= rect.left && e.clientX <= rect.right &&
                   e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (isOver) {
      trashBin.classList.add("drag-over");
    } else {
      trashBin.classList.remove("drag-over");
    }
  }
}

function onMouseUp(e) {
  if (!draggedCard || !isDragging) {
    cleanupDrag();
    return;
  }
  
  e.preventDefault();
  
  const trashBin = document.querySelector(".trash-bin");
  const trashRect = trashBin.getBoundingClientRect();
  const isOverTrash = e.clientX >= trashRect.left && e.clientX <= trashRect.right &&
                      e.clientY >= trashRect.top && e.clientY <= trashRect.bottom;
  
  if (isOverTrash) {
    draggedCard.remove();
    cleanupDrag();
    return;
  }
  
  draggedCard.style.display = "none";
  const elemUnderCursor = document.elementFromPoint(e.clientX, e.clientY);
  draggedCard.style.display = "";
  
  const row = elemUnderCursor?.closest(".row");
  const hand = document.getElementById("hand");
  const originalParent = draggedCard.originalParent;
  
  draggedCard.style.position = "";
  draggedCard.style.left = "";
  draggedCard.style.top = "";
  draggedCard.style.width = "";
  draggedCard.style.height = "";
  draggedCard.style.zIndex = "";
  draggedCard.style.margin = "";
  draggedCard.style.cursor = "";
  draggedCard.style.pointerEvents = "";
  draggedCard.style.display = "";
  draggedCard.classList.remove("dragging");
  
  if (row) {
    const rowType = row.dataset.row;
    const cardType = draggedCard.dataset.type;
    const cardsContainer = row.querySelector('.row-cards');
    const cardsInRow = cardsContainer ? cardsContainer.querySelectorAll('.card:not(.dead)').length : 0;
    
    if (cardsInRow >= 3) {
      if (hand && originalParent === hand) {
        const children = Array.from(hand.children);
        const originalIndex = draggedCard._originalIndex;
        if (originalIndex !== undefined && originalIndex < children.length) {
          hand.insertBefore(draggedCard, children[originalIndex]);
        } else {
          hand.appendChild(draggedCard);
        }
      } else if (hand) {
        hand.appendChild(draggedCard);
      } else {
        draggedCard.remove();
      }
      cleanupDrag();
      return;
    }
    
    if (rowType === cardType && cardsContainer) {
      cardsContainer.appendChild(draggedCard);
      triggerCardAbility(draggedCard, 'onDeploy', {});
      updateRowStats();
      cleanupDrag();
      return;
    }
  }
  
  if (hand && originalParent === hand) {
    const children = Array.from(hand.children);
    const originalIndex = draggedCard._originalIndex;
    if (originalIndex !== undefined && originalIndex < children.length) {
      hand.insertBefore(draggedCard, children[originalIndex]);
    } else {
      hand.appendChild(draggedCard);
    }
  } else if (hand) {
    hand.appendChild(draggedCard);
  } else {
    draggedCard.remove();
  }
  
  cleanupDrag();
}

function cleanupDrag() {
  if (draggedCard) {
    draggedCard.classList.remove("dragging");
    draggedCard.style.removeProperty("position");
    draggedCard.style.removeProperty("left");
    draggedCard.style.removeProperty("top");
    draggedCard.style.removeProperty("zIndex");
    draggedCard.style.removeProperty("width");
    draggedCard.style.removeProperty("height");
    draggedCard.style.removeProperty("margin");
    draggedCard.style.removeProperty("cursor");
    draggedCard.style.removeProperty("pointer-events");
    draggedCard = null;
  }
  isDragging = false;
  document.removeEventListener("mousemove", onMouseMove);
  document.removeEventListener("mouseup", onMouseUp);
  
  const trashBin = document.querySelector(".trash-bin");
  if (trashBin) {
    trashBin.classList.remove("drag-over");
  }
}


// ==========================================
// 10. ОБНОВЛЕНИЕ СТАТИСТИКИ РЯДОВ
// ==========================================

function updateRowStats() {
  const sides = ['player', 'enemy'];
  const types = ['melee', 'mid', 'ranged'];
  
  sides.forEach(side => {
    types.forEach(type => {
      const rowContainer = document.querySelector(`.${side} .row[data-row="${type}"] .row-cards`);
      const statsContainer = document.querySelector(`.${side} .row[data-row="${type}"] .row-stats`);
      
      if (!rowContainer || !statsContainer) return;
      
      const cards = rowContainer.querySelectorAll('.card:not(.dead)');
      let totalAttack = 0;
      let totalHp = 0;
      
      cards.forEach(card => {
        totalAttack += Number(card.dataset.attack) || 0;
        totalHp += Number(card.dataset.hp) || 0;
      });
      
      const attackSpan = statsContainer.querySelector('.stat-attack');
      const hpSpan = statsContainer.querySelector('.stat-hp');
      
      if (attackSpan) attackSpan.textContent = `⚔️${totalAttack}`;
      if (hpSpan) hpSpan.textContent = `❤️${totalHp}`;
    });
  });
}


// ==========================================
// 11. СПРАВОЧНИК КАРТ (CARD GUIDE)
// ==========================================

function formatAbilities(abilities) {
  if (!abilities || abilities.length === 0) {
    return '<div class="guide-ability">❌ Нет способностей</div>';
  }
  return abilities.map(ability => {
    const parsed = parseAbility(ability);
    let text = '';
    let triggerText = '';
    switch(parsed.trigger) {
      case 'onDeploy': triggerText = '🚀 При размещении: '; break;
      case 'onDeath': triggerText = '💀 При смерти: '; break;
      case 'onTurnEnd': triggerText = '⏰ В конце хода: '; break;
      default: triggerText = '✨ ';
    }
    switch(parsed.effect) {
      case 'damageRandomEnemy':
        text = `${triggerText}🎯 Наносит ${parsed.value} урона случайному врагу`;
        break;
      case 'damageAllEnemies':
        text = `${triggerText}💥 Наносит ${parsed.value} урона ВСЕМ врагам`;
        break;
      case 'healRandomAlly':
        text = `${triggerText}💚 Лечит союзника на +${parsed.value} HP`;
        break;
      case 'drawCard':
        text = `${triggerText}📖 Тянет ${parsed.value} карту(ы)`;
        break;
      case 'damageAll':
        text = `${triggerText}☠️ Наносит ${parsed.value} урона ВСЕМ`;
        break;
      case 'damageEnemyRow':
        const rowName = parsed.target === 'melee' ? 'Ближний' : (parsed.target === 'mid' ? 'Средний' : 'Дальний');
        text = `${triggerText}🎯 Наносит ${parsed.value} урона ${rowName} ряду врага`;
        break;
      default:
        text = `${triggerText}${parsed.effect}: ${parsed.value}`;
    }
    return `<div class="guide-ability">${text}</div>`;
  }).join('');
}

function showCardGuide() {
  const container = document.getElementById('guidePageContent');
  if (!container) return;
  container.innerHTML = '';
  const gridContainer = document.createElement('div');
  gridContainer.className = 'cards-guide-container';
  allCards.forEach((card) => {
    const guideCard = document.createElement('div');
    guideCard.className = 'guide-card';
    guideCard.innerHTML = `
      <div class="guide-card-image placeholder" data-src="${card.image}">
        <div class="image-loader">🖼️ Загрузка...</div>
      </div>
      <div class="guide-card-name">${card.name}</div>
      <div class="guide-card-stats">
        <span>⚔️ ${card.attack}</span>
        <span>❤️ ${card.hp}</span>
      </div>
      <div class="guide-card-type ${card.type}">
        ${card.type === 'melee' ? '🔴 Ближний' : card.type === 'mid' ? '🟡 Средний' : '🔵 Дальний'}
      </div>
      <div class="guide-abilities">
        <div class="guide-abilities-title">✨ Способности:</div>
        ${formatAbilities(card.abilities)}
      </div>
    `;
    gridContainer.appendChild(guideCard);
  });
  container.appendChild(gridContainer);
  setTimeout(() => {
    document.querySelectorAll('.guide-card-image.placeholder').forEach(img => {
      const src = img.dataset.src;
      if (src) {
        const backgroundImg = new Image();
        backgroundImg.onload = () => {
          img.style.backgroundImage = `url('${src}')`;
          img.style.backgroundSize = 'contain';
          img.style.backgroundPosition = 'center';
          img.classList.remove('placeholder');
          const loader = img.querySelector('.image-loader');
          if (loader) loader.remove();
        };
        backgroundImg.onerror = () => {
          img.style.background = '#333';
          const loader = img.querySelector('.image-loader');
          if (loader) loader.textContent = '❌ Ошибка';
        };
        backgroundImg.src = src;
      }
    });
  }, 100);
}

function openCardGuide() {
  const guidePage = document.getElementById('guidePage');
  if (guidePage) {
    showCardGuide();
    guidePage.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
}

function closeCardGuide() {
  const guidePage = document.getElementById('guidePage');
  if (guidePage) {
    guidePage.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

function setupCardGuide() {
  const deck = document.getElementById('deck');
  if (deck) {
    deck.removeEventListener('click', openCardGuide);
    deck.addEventListener('click', openCardGuide);
  }
  const closeGuideBtn = document.getElementById('closeGuideBtn');
  if (closeGuideBtn) {
    closeGuideBtn.removeEventListener('click', closeCardGuide);
    closeGuideBtn.addEventListener('click', closeCardGuide);
  }
  const guidePage = document.getElementById('guidePage');
  if (guidePage) {
    guidePage.addEventListener('click', (e) => {
      if (e.target === guidePage) {
        closeCardGuide();
      }
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && guidePage && !guidePage.classList.contains('hidden')) {
      closeCardGuide();
    }
  });
}


// ==========================================
// 12. ИНИЦИАЛИЗАЦИЯ И ЗАПУСК (INIT)
// ==========================================

function initGame() {
  createHand();
  setupTurnButton();
  setupCardGuide();
  enemyTurn();
  enemyTurn();
  updateRowStats();
  gameStarted = true;
}

document.getElementById("restartBtn").onclick = () => {
  restartGame();
};

initGame();