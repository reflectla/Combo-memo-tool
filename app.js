// ============================================
// データモデル定義
// ============================================

// デフォルトの技マスタデータ
const defaultMoves = [
    // 通常技
    { id: "5LP", displayName: "立ち弱P", notation: "5LP", category: "normal" },
    { id: "5MP", displayName: "立ち中P", notation: "5MP", category: "normal" },
    { id: "5HP", displayName: "立ち強P", notation: "5HP", category: "normal" },
    { id: "5LK", displayName: "立ち弱K", notation: "5LK", category: "normal" },
    { id: "5MK", displayName: "立ち中K", notation: "5MK", category: "normal" },
    { id: "5HK", displayName: "立ち強K", notation: "5HK", category: "normal" },
    { id: "2LP", displayName: "しゃがみ弱P", notation: "2LP", category: "normal" },
    { id: "2MP", displayName: "しゃがみ中P", notation: "2MP", category: "normal" },
    { id: "2HP", displayName: "しゃがみ強P", notation: "2HP", category: "normal" },
    { id: "2LK", displayName: "しゃがみ弱K", notation: "2LK", category: "normal" },
    { id: "2MK", displayName: "しゃがみ中K", notation: "2MK", category: "normal" },
    { id: "2HK", displayName: "しゃがみ強K", notation: "2HK", category: "normal" },

    // 必殺技
    { id: "236P", displayName: "波動拳", notation: "236P", category: "special" },
    { id: "623P", displayName: "昇龍拳", notation: "623P", category: "special" },
    { id: "214K", displayName: "竜巻旋風脚", notation: "214K", category: "special" },
    { id: "236K", displayName: "鎌払い", notation: "236K", category: "special" },

    // 超必殺技
    { id: "236236P", displayName: "真空波動拳", notation: "236236P", category: "super" },
    { id: "236236K", displayName: "真空竜巻旋風脚", notation: "236236K", category: "super" },
    { id: "214214K", displayName: "滅殺豪昇龍", notation: "214214K", category: "super" }
];

// デフォルトの接続タイプ
const defaultLinkTypes = [
    { id: "normal", symbol: ">", label: "通常接続" },
    { id: "cancel", symbol: "xx", label: "キャンセル" }
];

// デフォルトの修飾子
const defaultModifiers = [
    { id: "delay", symbol: "(dl)", label: "ディレイ" }
];

// ============================================
// アプリケーション状態
// ============================================

let profiles = []; // プロファイルの配列
let currentProfileId = null; // 現在選択中のプロファイルID
let currentProfile = null; // 現在のプロファイルオブジェクト
let comboTokens = []; // 現在のコンボトークン配列
let currentLinkType = "normal"; // 現在選択中のリンクタイプ
let isTextMode = false; // テキストモード/ビジュアルモード
let currentFileHandle = null; // ファイル上書き用にハンドルを保持
let insertPosition = null; // 挿入位置
let loadedComboId = null; // 現在読み込んでいるコンボID
let selectedFilterTags = new Set(); // タグフィルターの選択中タグ

// ============================================
// 初期化
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    loadProfiles();

    // ファイルハンドルの復元（上書き保存用）
    try {
        const storedHandle = await getStoredFileHandle();
        if (storedHandle) {
            if (await verifyPermission(storedHandle, true)) {
                currentFileHandle = storedHandle;
            }
        }
    } catch (e) {
        console.error("Failed to restore file handle:", e);
    }

    // プロファイルがない場合はデフォルトを作成
    if (profiles.length === 0) {
        createDefaultProfile();
    }

    // 最後に使っていたプロファイルを復元
    const lastProfileId = localStorage.getItem('lastProfileId');
    if (lastProfileId) {
        const lastProfile = profiles.find(p => p.id === lastProfileId);
        if (lastProfile) {
            switchProfile(lastProfileId);
        } else if (profiles.length > 0) {
            switchProfile(profiles[0].id);
        }
    } else if (profiles.length > 0) {
        switchProfile(profiles[0].id);
    }

    renderProfileSelector();
    renderTagUI();
    setupEventListeners();
    updateFileNameDisplay();

    // ファイルハンドルがあれば自動読み込みを試みる
    tryAutoLoad();
}

function createDefaultProfile() {
    const profile = {
        id: generateId(),
        gameName: "デフォルト",
        characterName: "汎用キャラクター",
        moves: JSON.parse(JSON.stringify(defaultMoves)),
        linkTypes: JSON.parse(JSON.stringify(defaultLinkTypes)),
        modifiers: JSON.parse(JSON.stringify(defaultModifiers)),
        combos: []
    };

    profiles.push(profile);
    saveProfiles();
}

// ============================================
// イベントリスナー設定
// ============================================

function setupEventListeners() {
    // キャラクター管理
    document.getElementById('profileSelect').addEventListener('change', (e) => {
        if (e.target.value) {
            switchProfile(e.target.value);
        }
    });
    document.getElementById('newProfileBtn').addEventListener('click', () => showProfileModal('create'));
    document.getElementById('editProfileBtn').addEventListener('click', () => {
        if (currentProfileId) {
            showProfileModal('edit', currentProfileId);
        }
    });

    // コンボ操作
    document.getElementById('toggleEditModeBtn').addEventListener('click', toggleEditMode);
    document.getElementById('saveToLibraryBtn').addEventListener('click', () => {
        const name = document.getElementById('currentComboName').value.trim();
        const damage = document.getElementById('currentComboDamage').value.trim();
        const tags = document.getElementById('currentComboTags') ? document.getElementById('currentComboTags').value.trim() : '';
        const notes = document.getElementById('currentComboNotes').value.trim();
        
        if (comboTokens.length === 0) {
            showNotification('コンボが空です', 'error');
            return;
        }
        
        if (!name) {
            showComboSaveModal();
            return;
        }

        saveComboToLibrary(name, damage, tags, notes);
    });
    document.getElementById('updateComboBtn').addEventListener('click', updateLoadedCombo);
    document.getElementById('clearComboBtn').addEventListener('click', clearCombo);
    document.getElementById('applyTextBtn').addEventListener('click', applyTextMode);

    // サイドバー
    document.getElementById('toggleSidebarBtn').addEventListener('click', toggleSidebar);
    document.getElementById('comboSearchInput').addEventListener('input', (e) => {
        renderComboLibrary(e.target.value);
    });
    // タグフィルター開閉バー
    document.getElementById('tagFilterToggleBar').addEventListener('click', () => {
        const container = document.getElementById('comboTagFilterContainer');
        const arrow = document.getElementById('tagFilterArrow');
        const isOpen = container.classList.contains('tag-filter-open');
        if (isOpen) {
            container.classList.remove('tag-filter-open');
            arrow.textContent = '▶';
        } else {
            container.classList.add('tag-filter-open');
            arrow.textContent = '▼';
        }
    });
    // 「全て外す」ボタン
    document.getElementById('clearAllTagsBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        selectedFilterTags.clear();
        renderTagUI();
        renderComboLibrary(document.getElementById('comboSearchInput').value);
    });
    // タグフィルター（チェックボックス）
    document.getElementById('comboTagFilterContainer').addEventListener('change', (e) => {
        if (e.target.type === 'checkbox' && e.target.dataset.tag !== undefined) {
            const tag = e.target.dataset.tag;
            if (e.target.checked) {
                selectedFilterTags.add(tag);
            } else {
                selectedFilterTags.delete(tag);
            }
            updateClearAllTagsBtnVisibility();
            renderComboLibrary(document.getElementById('comboSearchInput').value);
        }
    });
    document.getElementById('comboSortSelect').addEventListener('change', () => {
        renderComboLibrary(document.getElementById('comboSearchInput').value);
    });
    
    // タグ入力補助
    document.getElementById('existingTagsContainer').addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' && e.target.dataset.tag) {
            const tagInput = document.getElementById('currentComboTags');
            if (!tagInput) return;
            const newTag = e.target.dataset.tag;
            let currentTags = tagInput.value.split(',').map(t => t.trim()).filter(t => t);
            if (!currentTags.includes(newTag)) {
                currentTags.push(newTag);
                tagInput.value = currentTags.join(', ');
            }
        }
    });

    // エクスポート用
    document.getElementById('selectAllCombos').addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.combo-select-cb');
        checkboxes.forEach(cb => cb.checked = e.target.checked);
    });
    document.getElementById('exportSelectedCombosBtn').addEventListener('click', exportSelectedCombosText);

    // 技追加ボタン
    document.querySelectorAll('.add-move-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const category = e.currentTarget.dataset.category;
            showMoveModal('create', null, category);
        });
    });

    document.getElementById('addModifierBtn').addEventListener('click', () => showModifierModal('create'));
    document.getElementById('addLinkTypeBtn').addEventListener('click', () => showLinkModal('create'));

    // エクスポート/インポート/ヘルプ
    document.getElementById('helpBtn').addEventListener('click', showHelpModal);
    document.getElementById('saveFileBtn').addEventListener('click', saveFile);
    document.getElementById('saveAsFileBtn').addEventListener('click', saveAsFile);
    document.getElementById('openFileBtn').addEventListener('click', openFile);
}

// ============================================
// キャラクター（旧プロファイル）管理
// ============================================

function createProfile(gameName, characterName, baseProfileId = null) {
    let moves, linkTypes, modifiers;
    
    if (baseProfileId) {
        const base = profiles.find(p => p.id === baseProfileId);
        if (base) {
            moves = JSON.parse(JSON.stringify(base.moves));
            linkTypes = JSON.parse(JSON.stringify(base.linkTypes));
            modifiers = JSON.parse(JSON.stringify(base.modifiers));
        } else {
            moves = JSON.parse(JSON.stringify(defaultMoves));
            linkTypes = JSON.parse(JSON.stringify(defaultLinkTypes));
            modifiers = JSON.parse(JSON.stringify(defaultModifiers));
        }
    } else {
        moves = JSON.parse(JSON.stringify(defaultMoves));
        linkTypes = JSON.parse(JSON.stringify(defaultLinkTypes));
        modifiers = JSON.parse(JSON.stringify(defaultModifiers));
    }

    const profile = {
        id: generateId(),
        gameName,
        characterName,
        moves,
        linkTypes,
        modifiers,
        combos: []
    };

    profiles.push(profile);
    saveProfiles();
    renderProfileSelector();
    switchProfile(profile.id);
    showNotification('キャラクターを作成しました', 'success');
}

function updateProfile(profileId, data) {
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return;

    profile.gameName = data.gameName;
    profile.characterName = data.characterName;

    saveProfiles();
    renderProfileSelector();

    if (currentProfileId === profileId) {
        currentProfile = profile;
    }

    showNotification('キャラクターを更新しました', 'success');
}

function deleteProfile(profileId) {
    if (!confirm('このキャラクターを削除しますか？')) return;

    profiles = profiles.filter(p => p.id !== profileId);
    saveProfiles();
    renderProfileSelector();

    if (currentProfileId === profileId) {
        if (profiles.length > 0) {
            switchProfile(profiles[0].id);
        } else {
            createDefaultProfile();
            switchProfile(profiles[0].id);
        }
    }

    showNotification('キャラクターを削除しました', 'success');
}

function switchProfile(profileId) {
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return;

    currentProfileId = profileId;
    currentProfile = profile;
    localStorage.setItem('lastProfileId', profileId);
    comboTokens = [];
    loadedComboId = null;
    selectedFilterTags = new Set();
    
    const nameInput = document.getElementById('currentComboName');
    if (nameInput) {
        nameInput.value = '';
        document.getElementById('currentComboDamage').value = '';
        document.getElementById('currentComboNotes').value = '';
    }

    if (typeof updateComboBtnVisibility === 'function') updateComboBtnVisibility();

    document.getElementById('profileSelect').value = profileId;

    renderMoveButtons();
    renderLinkButtons();
    renderModifierButtons();
    renderComboLibrary();
    renderTagUI();
    updateComboDisplay();
}

function renderProfileSelector() {
    const select = document.getElementById('profileSelect');
    select.innerHTML = '<option value="">キャラクターを選択...</option>';

    profiles.forEach(profile => {
        const option = document.createElement('option');
        option.value = profile.id;
        option.textContent = `${profile.gameName} - ${profile.characterName}`;
        select.appendChild(option);
    });

    if (currentProfileId) {
        select.value = currentProfileId;
    }
}

// ============================================
// 技管理
// ============================================

function addMove(category, moveData) {
    if (!currentProfile) return;

    // ID重複チェック
    if (currentProfile.moves.find(m => m.id === moveData.id)) {
        showNotification('同じIDの技が既に存在します', 'error');
        return;
    }

    const move = {
        id: moveData.id,
        displayName: moveData.displayName,
        notation: moveData.notation,
        category: category
    };

    currentProfile.moves.push(move);
    saveProfiles();
    renderMoveButtons();
    showNotification('技を追加しました', 'success');
}

function updateMove(moveId, moveData) {
    if (!currentProfile) return;

    const move = currentProfile.moves.find(m => m.id === moveId);
    if (!move) return;

    // ID変更時の重複チェック
    if (moveData.id !== moveId && currentProfile.moves.find(m => m.id === moveData.id)) {
        showNotification('同じIDの技が既に存在します', 'error');
        return;
    }

    move.id = moveData.id;
    move.displayName = moveData.displayName;
    move.notation = moveData.notation;

    saveProfiles();
    renderMoveButtons();
    showNotification('技を更新しました', 'success');
}

function deleteMove(moveId) {
    if (!currentProfile) return;

    currentProfile.moves = currentProfile.moves.filter(m => m.id !== moveId);

    // コンボ内の技も削除
    comboTokens = comboTokens.filter(token => {
        if (token.type === 'move' && token.id === moveId) {
            return false;
        }
        return true;
    });

    saveProfiles();
    renderMoveButtons();
    updateComboDisplay();
    showNotification('技を削除しました', 'success');
}

// ============================================
// 修飾子・接続タイプ管理
// ============================================

function addModifierType(symbol, label) {
    if (!currentProfile) return;

    const modifier = {
        id: generateId(),
        symbol,
        label
    };

    currentProfile.modifiers.push(modifier);
    saveProfiles();
    renderModifierButtons();
    showNotification('修飾子を追加しました', 'success');
}

function updateModifierType(id, symbol, label) {
    if (!currentProfile) return;

    const modifier = currentProfile.modifiers.find(m => m.id === id);
    if (!modifier) return;

    modifier.symbol = symbol;
    modifier.label = label;

    saveProfiles();
    renderModifierButtons();
    showNotification('修飾子を更新しました', 'success');
}

function deleteModifierType(id) {
    if (!currentProfile) return;
    if (!confirm('この修飾子を削除しますか？')) return;

    currentProfile.modifiers = currentProfile.modifiers.filter(m => m.id !== id);
    saveProfiles();
    renderModifierButtons();
    showNotification('修飾子を削除しました', 'success');
}

function addLinkType(symbol, label) {
    if (!currentProfile) return;

    const linkType = {
        id: generateId(),
        symbol,
        label
    };

    currentProfile.linkTypes.push(linkType);
    saveProfiles();
    renderLinkButtons();
    showNotification('接続タイプを追加しました', 'success');
}

function updateLinkType(id, symbol, label) {
    if (!currentProfile) return;

    const linkType = currentProfile.linkTypes.find(l => l.id === id);
    if (!linkType) return;

    linkType.symbol = symbol;
    linkType.label = label;

    saveProfiles();
    renderLinkButtons();
    showNotification('接続タイプを更新しました', 'success');
}

function deleteLinkType(id) {
    if (!currentProfile) return;
    if (!confirm('この接続タイプを削除しますか？')) return;

    currentProfile.linkTypes = currentProfile.linkTypes.filter(l => l.id !== id);
    saveProfiles();
    renderLinkButtons();
    showNotification('接続タイプを削除しました', 'success');
}

// ============================================
// UI レンダリング
// ============================================

function renderMoveButtons() {
    if (!currentProfile) return;

    const normalMovesContainer = document.getElementById('normalMoves');
    const specialMovesContainer = document.getElementById('specialMoves');
    const superMovesContainer = document.getElementById('superMoves');
    const jumpMovesContainer = document.getElementById('jumpMoves');

    if (!normalMovesContainer || !specialMovesContainer || !superMovesContainer) return;

    const normalMoves = currentProfile.moves.filter(m => m.category === 'normal');
    const specialMoves = currentProfile.moves.filter(m => m.category === 'special');
    const superMoves = currentProfile.moves.filter(m => m.category === 'super');
    const jumpMoves = currentProfile.moves.filter(m => m.category === 'jump');

    normalMovesContainer.innerHTML = normalMoves.map(createMoveButton).join('');
    specialMovesContainer.innerHTML = specialMoves.map(createMoveButton).join('');
    superMovesContainer.innerHTML = superMoves.map(createMoveButton).join('');
    
    if (jumpMovesContainer) {
        jumpMovesContainer.innerHTML = jumpMoves.map(createMoveButton).join('');
    }

    // 技ボタンのイベントリスナー
    document.querySelectorAll('.move-btn').forEach((btn) => {
        // クリックでコンボに追加
        btn.addEventListener('click', (e) => {
            if (e.target.closest('.move-btn-actions')) return;
            const moveId = btn.dataset.moveId;
            if (insertPosition !== null) {
                insertPosition = insertMoveAt(insertPosition, moveId);
            } else {
                addMoveToken(moveId);
            }
        });

        // ドラッグ＆ドロップ
        btn.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/move-id', btn.dataset.moveId);
            e.dataTransfer.setData('text/category', btn.dataset.category);
            btn.classList.add('dragging');
        });

        btn.addEventListener('dragend', () => {
            btn.classList.remove('dragging');
        });

        btn.addEventListener('dragover', (e) => {
            e.preventDefault();
            btn.classList.add('drag-over');
        });

        btn.addEventListener('dragleave', () => {
            btn.classList.remove('drag-over');
        });

        btn.addEventListener('drop', (e) => {
            e.preventDefault();
            btn.classList.remove('drag-over');
            const fromId = e.dataTransfer.getData('text/move-id');
            const toId = btn.dataset.moveId;
            const toCat = btn.dataset.category;

            if (fromId && fromId !== toId) {
                reorderMoves(fromId, toId, toCat);
            }
        });
    });

    // カテゴリコンテナ自体のドロップイベント（空の枠への移動用）
    const containers = [
        { id: 'normalMoves', cat: 'normal' },
        { id: 'specialMoves', cat: 'special' },
        { id: 'superMoves', cat: 'super' },
        { id: 'jumpMoves', cat: 'jump' }
    ];

    containers.forEach(item => {
        const el = document.getElementById(item.id);
        if (!el) return;

        el.addEventListener('dragover', (e) => {
            e.preventDefault();
            el.classList.add('drag-over-container');
        });

        el.addEventListener('dragleave', () => {
            el.classList.remove('drag-over-container');
        });

        el.addEventListener('drop', (e) => {
            e.preventDefault();
            el.classList.remove('drag-over-container');
            
            const fromId = e.dataTransfer.getData('text/move-id');
            // コンテナ自体の空きスペースに落ちた場合のみ処理
            if (fromId && e.target.id === item.id) {
                reorderMoves(fromId, null, item.cat);
            }
        });
    });

    // 編集・複製・削除ボタン
    document.querySelectorAll('.edit-move-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const moveId = btn.dataset.moveId;
            showMoveModal('edit', moveId);
        });
    });

    document.querySelectorAll('.clone-move-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const moveId = btn.dataset.moveId;
            const move = currentProfile.moves.find(m => m.id === moveId);
            if (move) {
                showMoveModal('create', moveId, move.category);
            }
        });
    });

    document.querySelectorAll('.delete-move-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const moveId = btn.dataset.moveId;
            deleteMove(moveId);
        });
    });
}

function reorderMoves(fromId, toId, toCat) {
    const fromIdx = currentProfile.moves.findIndex(m => m.id === fromId);
    if (fromIdx === -1) return;

    const item = currentProfile.moves[fromIdx];
    
    // カテゴリを更新
    if (toCat) {
        item.category = toCat;
    }

    if (toId) {
        // 特定の技の前に移動
        currentProfile.moves.splice(fromIdx, 1);
        const newToIdx = currentProfile.moves.findIndex(m => m.id === toId);
        currentProfile.moves.splice(newToIdx, 0, item);
    } else {
        // コンテナの末尾（そのカテゴリの最後）に移動
        currentProfile.moves.splice(fromIdx, 1);
        // そのカテゴリの最後の技のインデックスを探して挿入
        const lastInCatIdx = [...currentProfile.moves].reverse().findIndex(m => m.category === toCat);
        if (lastInCatIdx !== -1) {
            const insertIdx = currentProfile.moves.length - lastInCatIdx;
            currentProfile.moves.splice(insertIdx, 0, item);
        } else {
            currentProfile.moves.push(item);
        }
    }

    saveProfiles();
    renderMoveButtons();
}


function createMoveButton(move) {
    return `
        <div class="move-btn" data-move-id="${move.id}" data-category="${move.category}" draggable="true" role="button" tabindex="0">
            <div class="move-btn-content">
                <span class="move-name">${move.displayName}</span>
                <span class="move-notation">${move.notation}</span>
            </div>
            <div class="move-btn-actions">
                <button class="btn-icon-small edit-move-btn" data-move-id="${move.id}" title="編集">✏️</button>
                <button class="btn-icon-small clone-move-btn" data-move-id="${move.id}" title="コピーして新規作成">📄</button>
                <button class="btn-icon-small btn-danger delete-move-btn" data-move-id="${move.id}" title="削除">🗑️</button>
            </div>
        </div>
    `;
}

function renderLinkButtons() {
    if (!currentProfile) return;

    const container = document.getElementById('linkButtons');
    container.innerHTML = currentProfile.linkTypes.map(linkType => `
        <div class="link-btn ${currentLinkType === linkType.id ? 'active' : ''}" data-link="${linkType.id}" role="button" tabindex="0">
            <div class="link-btn-content">
                <span class="link-symbol">${linkType.symbol}</span>
                <span class="link-label" style="font-size: 0.8rem;">${linkType.label}</span>
            </div>
            <div class="move-btn-actions">
                <button class="btn-icon-small edit-link-btn" data-link-id="${linkType.id}" title="編集">✏️</button>
                <button class="btn-icon-small btn-danger delete-link-btn" data-link-id="${linkType.id}" title="削除">🗑️</button>
            </div>
        </div>
    `).join('');

    // イベントリスナー
    document.querySelectorAll('.link-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (e.target.closest('.move-btn-actions')) return;
            const linkId = btn.dataset.link;

            if (insertPosition !== null) {
                insertPosition = insertLinkTypeAt(insertPosition, linkId);
            } else {
                setLinkType(linkId);
            }
        });

        // ドラッグイベント
        btn.setAttribute('draggable', 'true');
        btn.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/link-id', btn.dataset.link);
            btn.classList.add('dragging');
        });
        btn.addEventListener('dragend', () => btn.classList.remove('dragging'));
        btn.addEventListener('dragover', (e) => {
            e.preventDefault();
            btn.classList.add('drag-over');
        });
        btn.addEventListener('dragleave', () => btn.classList.remove('drag-over'));
        btn.addEventListener('drop', (e) => {
            e.preventDefault();
            btn.classList.remove('drag-over');
            const fromId = e.dataTransfer.getData('text/link-id');
            const toId = btn.dataset.link;
            if (fromId && fromId !== toId) {
                reorderLinks(fromId, toId);
            }
        });
    });

    document.querySelectorAll('.edit-link-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            showLinkModal('edit', btn.dataset.linkId);
        });
    });

    document.querySelectorAll('.delete-link-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteLinkType(btn.dataset.linkId);
        });
    });
}

function reorderLinks(fromId, toId) {
    const fromIdx = currentProfile.linkTypes.findIndex(l => l.id === fromId);
    const toIdx = currentProfile.linkTypes.findIndex(l => l.id === toId);
    if (fromIdx !== -1 && toIdx !== -1) {
        const item = currentProfile.linkTypes.splice(fromIdx, 1)[0];
        currentProfile.linkTypes.splice(toIdx, 0, item);
        saveProfiles();
        renderLinkButtons();
    }
}


function renderModifierButtons() {
    if (!currentProfile) return;

    const container = document.getElementById('modifierButtons');
    container.innerHTML = currentProfile.modifiers.map(modifier => `
        <div class="modifier-btn" data-modifier="${modifier.id}" role="button" tabindex="0">
            <div class="modifier-btn-content">
                <span class="modifier-symbol">${modifier.symbol}</span>
                <span class="modifier-label" style="font-size: 0.8rem;">${modifier.label}</span>
            </div>
            <div class="move-btn-actions">
                <button class="btn-icon-small edit-modifier-btn" data-modifier-id="${modifier.id}" title="編集">✏️</button>
                <button class="btn-icon-small btn-danger delete-modifier-btn" data-modifier-id="${modifier.id}" title="削除">🗑️</button>
            </div>
        </div>
    `).join('');

    // イベントリスナー
    document.querySelectorAll('.modifier-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (e.target.closest('.move-btn-actions')) return;
            const modifierId = btn.dataset.modifier;
            if (insertPosition !== null) {
                insertPosition = insertModifierAt(insertPosition, modifierId);
            } else {
                addModifierToken(modifierId);
            }
        });

        // ドラッグイベント
        btn.setAttribute('draggable', 'true');
        btn.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/modifier-id', btn.dataset.modifier);
            btn.classList.add('dragging');
        });
        btn.addEventListener('dragend', () => btn.classList.remove('dragging'));
        btn.addEventListener('dragover', (e) => {
            e.preventDefault();
            btn.classList.add('drag-over');
        });
        btn.addEventListener('dragleave', () => btn.classList.remove('drag-over'));
        btn.addEventListener('drop', (e) => {
            e.preventDefault();
            btn.classList.remove('drag-over');
            const fromId = e.dataTransfer.getData('text/modifier-id');
            const toId = btn.dataset.modifier;
            if (fromId && fromId !== toId) {
                reorderModifiers(fromId, toId);
            }
        });
    });

    document.querySelectorAll('.edit-modifier-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            showModifierModal('edit', btn.dataset.modifierId);
        });
    });

    document.querySelectorAll('.delete-modifier-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteModifierType(btn.dataset.modifierId);
        });
    });
}

function reorderModifiers(fromId, toId) {
    const fromIdx = currentProfile.modifiers.findIndex(m => m.id === fromId);
    const toIdx = currentProfile.modifiers.findIndex(m => m.id === toId);
    if (fromIdx !== -1 && toIdx !== -1) {
        const item = currentProfile.modifiers.splice(fromIdx, 1)[0];
        currentProfile.modifiers.splice(toIdx, 0, item);
        saveProfiles();
        renderModifierButtons();
    }
}


// ============================================
// コンボ操作
// ============================================

function addMoveToken(moveId) {
    const move = currentProfile.moves.find(m => m.id === moveId);
    if (!move) return;

    // 2つ目以降の技の場合、リンクを自動挿入
    if (comboTokens.length > 0) {
        const lastToken = comboTokens[comboTokens.length - 1];
        if (lastToken.type === 'move' || lastToken.type === 'modifier') {
            comboTokens.push({
                type: 'link',
                kind: currentLinkType
            });
        }
    }

    comboTokens.push({
        type: 'move',
        id: moveId
    });

    updateComboDisplay();
    autoSave();
}

function addModifierToken(modifierId) {
    if (comboTokens.length === 0) {
        comboTokens.push({
            type: 'modifier',
            kind: modifierId
        });
    } else {
        const lastToken = comboTokens[comboTokens.length - 1];
        if (lastToken.type !== 'move' && lastToken.type !== 'link' && lastToken.type !== 'modifier') return;

        comboTokens.push({
            type: 'modifier',
            kind: modifierId
        });
    }

    updateComboDisplay();
    autoSave();
}

function insertModifierAt(index, modifierId) {
    // 修飾子は move, link, または modifier の後にのみ挿入可能
    // ただし index が 0 の場合（先頭）は許可する
    if (index > 0) {
        const prevToken = comboTokens[index - 1];
        if (prevToken.type !== 'move' && prevToken.type !== 'link' && prevToken.type !== 'modifier') return index;
    }

    comboTokens.splice(index, 0, {
        type: 'modifier',
        kind: modifierId
    });

    insertPosition = index + 1;
    updateComboDisplay();
    autoSave();
    return insertPosition;
}

function insertLinkTypeAt(index, linkId) {
    // 通常はMoveとMoveの間に入るものだが、手動挿入なのでユーザーの自由にさせる
    comboTokens.splice(index, 0, {
        type: 'link',
        kind: linkId
    });

    insertPosition = index + 1;
    updateComboDisplay();
    autoSave();
    return insertPosition;
}

function insertMoveAt(index, moveId) {
    const move = currentProfile.moves.find(m => m.id === moveId);
    if (!move) return index;

    // 挿入位置の前後にリンクを追加
    const tokensToInsert = [];

    if (index > 0) {
        const prevToken = comboTokens[index - 1];
        if (prevToken.type === 'move' || prevToken.type === 'modifier') {
            tokensToInsert.push({ type: 'link', kind: currentLinkType });
        }
    }

    tokensToInsert.push({ type: 'move', id: moveId });

    if (index < comboTokens.length) {
        const nextToken = comboTokens[index];
        if (nextToken.type === 'move') {
            tokensToInsert.push({ type: 'link', kind: currentLinkType });
        }
    }

    comboTokens.splice(index, 0, ...tokensToInsert);
    insertPosition = index + tokensToInsert.length;
    updateComboDisplay();
    autoSave();
    return insertPosition;
}

function removeToken(index) {
    comboTokens.splice(index, 1);

    // リンクの整合性チェック
    if (comboTokens.length > 0 && comboTokens[0].type === 'link') {
        comboTokens.shift();
    }

    for (let i = comboTokens.length - 1; i > 0; i--) {
        if (comboTokens[i].type === 'link' && comboTokens[i - 1].type === 'link') {
            comboTokens.splice(i, 1);
        }
    }

    updateComboDisplay();
    autoSave();
}

function clearCombo() {
    if (comboTokens.length === 0) return;

    if (confirm('コンボをクリアしますか?')) {
        comboTokens = [];
        loadedComboId = null;
        insertPosition = null;
        
        const nameInput = document.getElementById('currentComboName');
        if (nameInput) {
            nameInput.value = '';
            document.getElementById('currentComboDamage').value = '';
            document.getElementById('currentComboNotes').value = '';
        }
        
        const tagsInput = document.getElementById('currentComboTags');
        if (tagsInput) tagsInput.value = '';

        if (typeof updateComboBtnVisibility === 'function') updateComboBtnVisibility();
        updateComboDisplay();
        autoSave();
    }
}

function setLinkType(type) {
    currentLinkType = type;
    renderLinkButtons();
}

// ============================================
// テキストモード
// ============================================

function toggleEditMode() {
    isTextMode = !isTextMode;

    const visualMode = document.getElementById('visualModeDisplay');
    const textMode = document.getElementById('textModeDisplay');
    const label = document.getElementById('editModeLabel');

    if (isTextMode) {
        visualMode.style.display = 'none';
        textMode.style.display = 'flex';
        label.textContent = 'ビジュアルモード';

        // 現在のコンボをテキストエリアに設定
        const displayString = generateDisplayString(comboTokens);
        document.getElementById('comboTextArea').value = displayString;
    } else {
        visualMode.style.display = 'block';
        textMode.style.display = 'none';
        label.textContent = 'テキストモード';
    }
}

function applyTextMode() {
    const text = document.getElementById('comboTextArea').value.trim();

    if (!text) {
        comboTokens = [];
        insertPosition = null;
        toggleEditMode();
        updateComboDisplay();
        return;
    }

    try {
        const tokens = parseComboText(text);
        comboTokens = tokens;
        insertPosition = null; // テキスト適用後は一旦リセット
        toggleEditMode();
        updateComboDisplay();
        showNotification('テキストを適用しました', 'success');
    } catch (e) {
        showNotification('テキストの解析に失敗しました: ' + e.message, 'error');
    }
}

function parseComboText(text) {
    if (!currentProfile) return [];

    const tokens = [];
    const parts = text.split(/\s+/);

    for (const part of parts) {
        if (!part) continue;

        // 接続タイプをチェック
        const linkType = currentProfile.linkTypes.find(l => l.symbol === part);
        if (linkType) {
            tokens.push({ type: 'link', kind: linkType.id });
            continue;
        }

        // 修飾子をチェック
        const modifier = currentProfile.modifiers.find(m => m.symbol === part);
        if (modifier) {
            tokens.push({ type: 'modifier', kind: modifier.id });
            continue;
        }

        // 技を検索（表示名または入力表記で）
        const move = currentProfile.moves.find(m =>
            m.displayName === part || m.notation === part || m.id === part
        );

        if (move) {
            tokens.push({ type: 'move', id: move.id });
        } else {
            throw new Error(`不明な要素: ${part}`);
        }
    }

    return tokens;
}

// ============================================
// 表示更新
// ============================================

function updateComboDisplay() {
    const displayElement = document.getElementById('comboDisplay');
    const tokensElement = document.getElementById('comboTokens');

    if (comboTokens.length === 0) {
        displayElement.innerHTML = `
            <div class="combo-empty-state">
                <span class="empty-icon">✨</span>
                <p>技を選択してコンボを作成してください</p>
            </div>
        `;
        tokensElement.innerHTML = '';
        return;
    }

    const displayString = generateDisplayString(comboTokens, insertPosition);
    displayElement.innerHTML = displayString;

    let tokensHtml = comboTokens.map((token, index) => {
        return createTokenElement(token, index);
    }).join('');
    
    // 末尾の挿入ボタンを追加
    const activeClass = (insertPosition === comboTokens.length) ? 'active' : '';
    tokensHtml += `<button class="token-insert ${activeClass}" data-index="${comboTokens.length}" title="末尾に挿入">+</button>`;
    
    tokensElement.innerHTML = tokensHtml;

    // 各トークン内の挿入ボタンのアクティブ状態を設定
    document.querySelectorAll('.token-insert').forEach(btn => {
        const idx = parseInt(btn.dataset.index);
        if (idx === insertPosition) {
            btn.classList.add('active');
        }
    });

    // イベントリスナー
    document.querySelectorAll('.token-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            removeToken(index);
        });
    });

    document.querySelectorAll('.token-insert').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            if (insertPosition === index) {
                insertPosition = null; // 同じ場所をクリックしたら解除
            } else {
                insertPosition = index;
            }
            updateComboDisplay();
        });
    });

    // トークンのドラッグ＆ドロップイベント
    const tokens = document.querySelectorAll('.token');
    tokens.forEach(token => {
        token.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', token.dataset.index);
            token.classList.add('dragging');
        });

        token.addEventListener('dragend', () => {
            token.classList.remove('dragging');
        });

        token.addEventListener('dragover', (e) => {
            e.preventDefault();
            token.classList.add('drag-over');
        });

        token.addEventListener('dragleave', () => {
            token.classList.remove('drag-over');
        });

        token.addEventListener('drop', (e) => {
            e.preventDefault();
            token.classList.remove('drag-over');
            const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
            const toIndex = parseInt(token.dataset.index);
            if (fromIndex !== toIndex) {
                handleTokenMove(fromIndex, toIndex);
            }
        });
    });
}

function handleTokenMove(fromIndex, toIndex) {
    const movedItem = comboTokens.splice(fromIndex, 1)[0];
    comboTokens.splice(toIndex, 0, movedItem);
    updateComboDisplay();
    autoSave();
}


function generateDisplayString(tokens, cursorIndex = null) {
    if (!currentProfile) return '';

    const effectiveCursorIndex = (cursorIndex === null) ? tokens.length : cursorIndex;
    let html = '';

    for (let i = 0; i <= tokens.length; i++) {
        // カーソル位置の挿入（テキストの間にゼロ幅で配置）
        if (i === effectiveCursorIndex) {
            html += '<span class="combo-cursor"></span>';
        }

        if (i < tokens.length) {
            if (i > 0) html += ' ';
            const token = tokens[i];
            let content = '';
            switch (token.type) {
                case 'move':
                    const move = currentProfile.moves.find(m => m.id === token.id);
                    content = move ? (move.displayName || move.notation) : token.id;
                    break;
                case 'link':
                    const linkType = currentProfile.linkTypes.find(l => l.id === token.kind);
                    content = linkType ? linkType.symbol : token.kind;
                    break;
                case 'modifier':
                    const modifier = currentProfile.modifiers.find(m => m.id === token.kind);
                    content = modifier ? modifier.symbol : token.kind;
                    break;
            }
            html += content;
        }
    }

    return html;
}

function createTokenElement(token, index) {
    let className = 'token';
    let content = '';

    switch (token.type) {
        case 'move':
            const move = currentProfile.moves.find(m => m.id === token.id);
            className += ` ${move ? move.category : 'normal'}`;
            content = move ? move.displayName : token.id;
            break;
        case 'link':
            className += ' link';
            const linkType = currentProfile.linkTypes.find(l => l.id === token.kind);
            content = linkType ? linkType.symbol : token.kind;
            break;
        case 'modifier':
            className += ' modifier';
            const modifier = currentProfile.modifiers.find(m => m.id === token.kind);
            content = modifier ? modifier.symbol : token.kind;
            break;
    }

    return `
        <button class="token-insert" data-index="${index}" title="ここに挿入">+</button>
        <div class="${className}" draggable="true" data-index="${index}">
            <span>${content}</span>
            <button class="token-remove" data-index="${index}">×</button>
        </div>
    `;
}

// ============================================
// コンボライブラリ
// ============================================

function saveComboToLibrary(name, damage, tags, notes) {
    if (!currentProfile) return;
    if (comboTokens.length === 0) {
        showNotification('コンボが空です', 'error');
        return;
    }

    const combo = {
        id: generateId(),
        name,
        damage: parseInt(damage) || 0,
        tokens: JSON.parse(JSON.stringify(comboTokens)),
        displayString: generateDisplayString(comboTokens),
        tags: tags ? tags.split(',').map(t => t.trim()).filter(t => t) : [],
        notes: notes || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    currentProfile.combos.push(combo);
    saveProfiles();
    renderComboLibrary();
    renderTagUI();
    loadedComboId = combo.id;
    if (typeof updateComboBtnVisibility === 'function') updateComboBtnVisibility();
    showNotification('コンボをコンボメモに保存しました', 'success');
}

function loadComboFromLibrary(comboId) {
    if (!currentProfile) return;

    const combo = currentProfile.combos.find(c => c.id === comboId);
    if (!combo) return;

    comboTokens = JSON.parse(JSON.stringify(combo.tokens));
    loadedComboId = comboId;
    
    const nameInput = document.getElementById('currentComboName');
    if (nameInput) {
        nameInput.value = combo.name || '';
        document.getElementById('currentComboDamage').value = combo.damage || '';
        document.getElementById('currentComboNotes').value = combo.notes || '';
        const tagsInput = document.getElementById('currentComboTags');
        if (tagsInput) tagsInput.value = combo.tags ? combo.tags.join(', ') : '';
    }

    if (typeof updateComboBtnVisibility === 'function') updateComboBtnVisibility();
    updateComboDisplay();
    showNotification(`「${combo.name}」を読み込みました`, 'success');
}

function updateComboInLibrary(comboId, data) {
    if (!currentProfile) return;

    const combo = currentProfile.combos.find(c => c.id === comboId);
    if (!combo) return;

    combo.name = data.name;
    combo.damage = parseInt(data.damage) || 0;
    combo.tags = data.tags ? data.tags.split(',').map(t => t.trim()).filter(t => t) : [];
    combo.notes = data.notes || '';
    combo.updatedAt = new Date().toISOString();

    saveProfiles();
    renderComboLibrary();
    renderTagUI();
    showNotification('コンボを更新しました', 'success');
}

function deleteComboFromLibrary(comboId) {
    if (!currentProfile) return;
    if (!confirm('このコンボを削除しますか？')) return;

    currentProfile.combos = currentProfile.combos.filter(c => c.id !== comboId);
    saveProfiles();
    renderComboLibrary();
    renderTagUI();
    showNotification('コンボを削除しました', 'success');
}

function renderComboLibrary(searchQuery = '') {
    if (!currentProfile) return;

    const container = document.getElementById('comboLibraryList');
    const sortBy = document.getElementById('comboSortSelect').value;

    let combos = [...currentProfile.combos];

    // タグフィルター（複数選択→AND瘟いではなかOR条件）
    if (selectedFilterTags.size > 0) {
        combos = combos.filter(combo =>
            combo.tags && Array.from(selectedFilterTags).every(ft => combo.tags.includes(ft))
        );
    }

    // 検索フィルター
    if (searchQuery) {
        combos = combos.filter(combo =>
            combo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            combo.displayString.toLowerCase().includes(searchQuery.toLowerCase()) ||
            combo.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }

    // ソート
    combos.sort((a, b) => {
        switch (sortBy) {
            case 'name':
                return a.name.localeCompare(b.name);
            case 'damage':
                return b.damage - a.damage;
            case 'createdAt':
                return new Date(b.createdAt) - new Date(a.createdAt);
            case 'updatedAt':
            default:
                return new Date(b.updatedAt) - new Date(a.updatedAt);
        }
    });

    if (combos.length === 0) {
        container.innerHTML = '<p style="color: var(--color-text-muted); text-align: center; padding: 2rem;">コンボがありません</p>';
        return;
    }

    container.innerHTML = combos.map(combo => {
        let dateStr = '';
        const targetDate = combo.updatedAt || combo.createdAt;
        if (targetDate) {
            const d = new Date(targetDate);
            if (!isNaN(d.getTime())) {
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                const hh = String(d.getHours()).padStart(2, '0');
                const min = String(d.getMinutes()).padStart(2, '0');
                dateStr = `${yyyy}/${mm}/${dd} ${hh}:${min}`;
            }
        }

        return `
        <div class="combo-item" data-combo-id="${combo.id}">
            <div class="combo-item-header">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <input type="checkbox" class="combo-select-cb" data-combo-id="${combo.id}" style="cursor: pointer;" onclick="event.stopPropagation()">
                    <span class="combo-item-name">${combo.name}</span>
                </div>
                <span class="combo-item-damage">${combo.damage}</span>
            </div>
            <div class="combo-item-string">${combo.displayString}</div>
            ${combo.tags.length > 0 ? `
                <div class="combo-item-tags">
                    ${combo.tags.map(tag => `<span class="combo-tag">${tag}</span>`).join('')}
                </div>
            ` : ''}
            <div class="combo-item-actions">
                <button class="btn-icon-small load-combo-btn" data-combo-id="${combo.id}" title="読み込み">📂</button>
                <button class="btn-icon-small edit-combo-btn" data-combo-id="${combo.id}" title="編集">✏️</button>
                <button class="btn-icon-small btn-danger delete-combo-btn" data-combo-id="${combo.id}" title="削除">🗑️</button>
                <span style="font-size: 0.75rem; color: var(--color-text-muted); margin-left: 0.5rem; align-self: center;">${dateStr}</span>
            </div>
        </div>
        `;
    }).join('');

    // イベントリスナー
    document.querySelectorAll('.combo-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.combo-item-actions')) return;
            loadComboFromLibrary(item.dataset.comboId);
        });
    });

    document.querySelectorAll('.load-combo-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            loadComboFromLibrary(btn.dataset.comboId);
        });
    });

    document.querySelectorAll('.edit-combo-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            showComboEditModal(btn.dataset.comboId);
        });
    });

    document.querySelectorAll('.delete-combo-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteComboFromLibrary(btn.dataset.comboId);
        });
    });
}

function toggleSidebar() {
    const sidebar = document.getElementById('comboLibrarySidebar');
    const btn = document.getElementById('toggleSidebarBtn');
    sidebar.classList.toggle('collapsed');
    btn.querySelector('span').textContent = sidebar.classList.contains('collapsed') ? '▶' : '◀';
}

// ============================================
// モーダル
// ============================================

function showModal(title, bodyHTML, onConfirm) {
    const overlay = document.getElementById('modalOverlay');
    const container = document.getElementById('modalContainer');

    container.innerHTML = `
        <div class="modal-header">
            <h3 class="modal-title">${title}</h3>
            <button class="modal-close" id="modalCloseBtn">×</button>
        </div>
        <div class="modal-body">
            ${bodyHTML}
        </div>
        <div class="modal-footer">
            ${onConfirm 
                ? `<button class="btn btn-secondary" id="modalCancelBtn">キャンセル</button>
                   <button class="btn btn-primary" id="modalConfirmBtn">確定</button>`
                : `<button class="btn btn-secondary" id="modalCancelBtn">閉じる</button>`
            }
        </div>
    `;

    overlay.style.display = 'flex';

    document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
    document.getElementById('modalCancelBtn').addEventListener('click', closeModal);
    
    if (onConfirm) {
        document.getElementById('modalConfirmBtn').addEventListener('click', () => {
            if (onConfirm()) {
                closeModal();
            }
        });
    }

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeModal();
        }
    });
}

function closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
}

function showProfileModal(mode, profileId = null) {
    const profile = profileId ? profiles.find(p => p.id === profileId) : null;
    const title = mode === 'create' ? '新規キャラクター作成' : 'キャラクター編集';

    const bodyHTML = `
        <div class="form-group">
            <label class="form-label">ゲーム名</label>
            <input type="text" class="form-input" id="gameNameInput" value="${profile ? profile.gameName : ''}" placeholder="例: ストリートファイター6">
        </div>
        <div class="form-group">
            <label class="form-label">キャラクター名</label>
            <input type="text" class="form-input" id="characterNameInput" value="${profile ? profile.characterName : ''}" placeholder="例: リュウ">
        </div>
        ${mode === 'create' ? `
            <div class="form-group">
                <label class="form-label">引き継ぐキャラクター (任意)</label>
                <select class="form-input" id="inheritProfileSelect">
                    <option value="">完全新規（デフォルト技のみ）</option>
                    ${profiles.map(p => `<option value="${p.id}">${p.gameName} - ${p.characterName}</option>`).join('')}
                </select>
                <small style="color: var(--color-text-muted); font-size: 0.8rem; display: block; margin-top: 4px;">※接続タイプ、修飾子、技名を引き継ぎます（コンボは引き継ぎません）</small>
            </div>
        ` : ''}
        ${mode === 'edit' ? `
            <div class="form-group">
                <button class="btn btn-danger" id="deleteProfileBtn" style="width: 100%;">キャラクターを削除</button>
            </div>
        ` : ''}
    `;

    showModal(title, bodyHTML, () => {
        const gameName = document.getElementById('gameNameInput').value.trim();
        const characterName = document.getElementById('characterNameInput').value.trim();
        let baseProfileId = null;
        if (mode === 'create') {
            baseProfileId = document.getElementById('inheritProfileSelect').value;
        }

        if (!gameName || !characterName) {
            showNotification('ゲーム名とキャラクター名を入力してください', 'error');
            return false;
        }

        if (mode === 'create') {
            createProfile(gameName, characterName, baseProfileId);
        } else {
            updateProfile(profileId, { gameName, characterName });
        }

        return true;
    });

    if (mode === 'edit') {
        document.getElementById('deleteProfileBtn').addEventListener('click', () => {
            deleteProfile(profileId);
            closeModal();
        });
    }
}

function showMoveModal(mode, moveId = null, category = 'normal') {
    const move = moveId ? currentProfile.moves.find(m => m.id === moveId) : null;
    const title = mode === 'create' ? '技を追加' : '技を編集';

    // 新規追加時のみ「既存の技をコピー」セクションを表示
    const copyFromHTML = mode === 'create' ? `
        <div class="form-group">
            <label class="form-label" style="color: var(--color-accent-secondary);">📋 既存の技をベースにする（任意）</label>
            <select class="form-input" id="moveCopySelect" style="font-size: 0.85rem;">
                <option value="">— 空白から新規作成 —</option>
                ${(() => {
                    // カテゴリの優先順位を決定
                    const priority = {
                        'normal': ['normal', 'jump', 'special', 'super'],
                        'jump': ['jump', 'normal', 'special', 'super'],
                        'special': ['special', 'super', 'normal', 'jump'],
                        'super': ['super', 'special', 'normal', 'jump']
                    };
                    const order = priority[category] || ['normal', 'jump', 'special', 'super'];
                    
                    // 並び替えてからマッピング
                    return [...currentProfile.moves].sort((a, b) => {
                        const indexA = order.indexOf(a.category);
                        const indexB = order.indexOf(b.category);
                        if (indexA !== indexB) return indexA - indexB;
                        return 0; // 同一カテゴリ内は元の順序を維持
                    }).map(m =>
                        `<option value="${m.id}" data-name="${m.displayName}" data-notation="${m.notation}">${m.displayName}（${m.notation}）</option>`
                    ).join('');
                })()}
            </select>
            <small style="color: var(--color-text-muted); font-size: 0.78rem; margin-top: 4px; display: block;">
                選択すると表示名・入力表記が自動入力されます。その後自由に編集してください。
            </small>
        </div>
        <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 0.5rem 0;">
    ` : '';

    const bodyHTML = `
        ${copyFromHTML}
        <div class="form-group">
            <label class="form-label">表示名</label>
            <input type="text" class="form-input" id="moveNameInput" value="${move ? move.displayName : ''}" placeholder="例: 立ち弱P">
        </div>
        <div class="form-group">
            <label class="form-label">入力表記</label>
            <input type="text" class="form-input" id="moveNotationInput" value="${move ? move.notation : ''}" placeholder="例: 5LP">
        </div>
    `;

    showModal(title, bodyHTML, () => {
        const displayName = document.getElementById('moveNameInput').value.trim();
        const notation = document.getElementById('moveNotationInput').value.trim();

        if (!displayName || !notation) {
            showNotification('すべての項目を入力してください', 'error');
            return false;
        }

        if (mode === 'create') {
            const id = generateId();
            addMove(category, { id, displayName, notation });
        } else {
            updateMove(moveId, { id: moveId, displayName, notation });
        }

        return true;
    });

    // 新規追加時：コピー元セレクトの変更で各フィールドを自動入力
    if (mode === 'create') {
        const copySelect = document.getElementById('moveCopySelect');
        if (copySelect) {
            copySelect.addEventListener('change', () => {
                const selected = copySelect.options[copySelect.selectedIndex];
                if (selected.value) {
                    document.getElementById('moveNameInput').value = selected.dataset.name || '';
                    document.getElementById('moveNotationInput').value = selected.dataset.notation || '';
                    document.getElementById('moveNameInput').focus();
                    document.getElementById('moveNameInput').select();
                } else {
                    document.getElementById('moveNameInput').value = '';
                    document.getElementById('moveNotationInput').value = '';
                }
            });
        }
    }
}

function showModifierModal(mode, modifierId = null) {
    const modifier = modifierId ? currentProfile.modifiers.find(m => m.id === modifierId) : null;
    const title = mode === 'create' ? '修飾子を追加' : '修飾子を編集';

    const bodyHTML = `
        <div class="form-group">
            <label class="form-label">記号</label>
            <input type="text" class="form-input" id="modifierSymbolInput" value="${modifier ? modifier.symbol : ''}" placeholder="例: (jc)">
        </div>
        <div class="form-group">
            <label class="form-label">ラベル</label>
            <input type="text" class="form-input" id="modifierLabelInput" value="${modifier ? modifier.label : ''}" placeholder="例: ジャンプキャンセル">
        </div>
    `;

    showModal(title, bodyHTML, () => {
        const symbol = document.getElementById('modifierSymbolInput').value.trim();
        const label = document.getElementById('modifierLabelInput').value.trim();

        if (!symbol || !label) {
            showNotification('すべての項目を入力してください', 'error');
            return false;
        }

        if (mode === 'create') {
            addModifierType(symbol, label);
        } else {
            updateModifierType(modifierId, symbol, label);
        }

        return true;
    });
}

function showLinkModal(mode, linkId = null) {
    const linkType = linkId ? currentProfile.linkTypes.find(l => l.id === linkId) : null;
    const title = mode === 'create' ? '接続タイプを追加' : '接続タイプを編集';

    const bodyHTML = `
        <div class="form-group">
            <label class="form-label">記号</label>
            <input type="text" class="form-input" id="linkSymbolInput" value="${linkType ? linkType.symbol : ''}" placeholder="例: ~">
        </div>
        <div class="form-group">
            <label class="form-label">ラベル</label>
            <input type="text" class="form-input" id="linkLabelInput" value="${linkType ? linkType.label : ''}" placeholder="例: ホールド">
        </div>
    `;

    showModal(title, bodyHTML, () => {
        const symbol = document.getElementById('linkSymbolInput').value.trim();
        const label = document.getElementById('linkLabelInput').value.trim();

        if (!symbol || !label) {
            showNotification('すべての項目を入力してください', 'error');
            return false;
        }

        if (mode === 'create') {
            addLinkType(symbol, label);
        } else {
            updateLinkType(linkId, symbol, label);
        }

        return true;
    });
}

function showComboSaveModal() {
    if (comboTokens.length === 0) {
        showNotification('コンボが空です', 'error');
        return;
    }

    const currentName = document.getElementById('currentComboName') ? document.getElementById('currentComboName').value : '';
    const currentDamage = document.getElementById('currentComboDamage') ? document.getElementById('currentComboDamage').value : '';
    const currentNotes = document.getElementById('currentComboNotes') ? document.getElementById('currentComboNotes').value : '';

    const bodyHTML = `
        <div class="form-group">
            <label class="form-label">コンボ名</label>
            <input type="text" class="form-input" id="comboNameInput" placeholder="例: 基本コンボ1" value="${currentName}">
        </div>
        <div class="form-group">
            <label class="form-label">ダメージ</label>
            <input type="number" class="form-input" id="comboDamageInput" placeholder="例: 250" value="${currentDamage}">
        </div>
        <div class="form-group">
            <label class="form-label">タグ（カンマ区切り）</label>
            <input type="text" class="form-input" id="comboTagsInput" placeholder="例: 初心者向け, 中央">
        </div>
        <div class="form-group">
            <label class="form-label">メモ</label>
            <textarea class="form-textarea" id="comboNotesInput" placeholder="コンボの説明やメモ">${currentNotes}</textarea>
        </div>
    `;

    showModal('コンボメモに保存', bodyHTML, () => {
        const name = document.getElementById('comboNameInput').value.trim();
        const damage = document.getElementById('comboDamageInput').value.trim();
        const tags = document.getElementById('comboTagsInput').value.trim();
        const notes = document.getElementById('comboNotesInput').value.trim();

        if (!name) {
            showNotification('コンボ名を入力してください', 'error');
            return false;
        }

        saveComboToLibrary(name, damage, tags, notes);
        
        const nameInput = document.getElementById('currentComboName');
        if (nameInput) {
            nameInput.value = name;
            document.getElementById('currentComboDamage').value = damage;
            document.getElementById('currentComboNotes').value = notes;
        }
        
        return true;
    });
}

function showComboEditModal(comboId) {
    const combo = currentProfile.combos.find(c => c.id === comboId);
    if (!combo) return;

    const bodyHTML = `
        <div class="form-group">
            <label class="form-label">コンボ名</label>
            <input type="text" class="form-input" id="comboNameInput" value="${combo.name}">
        </div>
        <div class="form-group">
            <label class="form-label">ダメージ</label>
            <input type="number" class="form-input" id="comboDamageInput" value="${combo.damage}">
        </div>
        <div class="form-group">
            <label class="form-label">タグ（カンマ区切り）</label>
            <input type="text" class="form-input" id="comboTagsInput" value="${combo.tags.join(', ')}">
        </div>
        <div class="form-group">
            <label class="form-label">メモ</label>
            <textarea class="form-textarea" id="comboNotesInput">${combo.notes}</textarea>
        </div>
    `;

    showModal('コンボを編集', bodyHTML, () => {
        const name = document.getElementById('comboNameInput').value.trim();
        const damage = document.getElementById('comboDamageInput').value.trim();
        const tags = document.getElementById('comboTagsInput').value.trim();
        const notes = document.getElementById('comboNotesInput').value.trim();

        if (!name) {
            showNotification('コンボ名を入力してください', 'error');
            return false;
        }

        updateComboInLibrary(comboId, { name, damage, tags, notes });
        return true;
    });
}

// ============================================
// データ永続化
// ============================================

function saveProfiles() {
    try {
        localStorage.setItem('profiles', JSON.stringify(profiles));
    } catch (e) {
        console.error('Failed to save profiles:', e);
        showNotification('データの保存に失敗しました', 'error');
    }
}

function loadProfiles() {
    try {
        const saved = localStorage.getItem('profiles');
        if (saved) {
            profiles = JSON.parse(saved);
        }
    } catch (e) {
        console.error('Failed to load profiles:', e);
    }
}

function autoSave() {
    saveProfiles();
}

// ============================================
// ファイルシステム連携 (File System Access API)
// ============================================

// IndexedDB Helper
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('ComboMemoStorage', 1);
        request.onupgradeneeded = (e) => {
            e.target.result.createObjectStore('fileHandles');
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function storeFileHandle(handle) {
    try {
        const db = await initDB();
        const tx = db.transaction('fileHandles', 'readwrite');
        tx.objectStore('fileHandles').put(handle, 'mainFile');
        return new Promise((resolve) => {
            tx.oncomplete = resolve;
        });
    } catch (e) {
        console.error("IndexedDB store error", e);
    }
}

async function getStoredFileHandle() {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('fileHandles', 'readonly');
            const request = tx.objectStore('fileHandles').get('mainFile');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error("IndexedDB get error", e);
        return null;
    }
}

async function verifyPermission(fileHandle, readWrite) {
    const options = {};
    if (readWrite) {
        options.mode = 'readwrite';
    }
    if ((await fileHandle.queryPermission(options)) === 'granted') {
        return true;
    }
    if ((await fileHandle.requestPermission(options)) === 'granted') {
        return true;
    }
    return false;
}

function getDataString() {
    const data = {
        profiles: profiles,
        version: "1.0",
        exportDate: new Date().toISOString()
    };
    return JSON.stringify(data, null, 2);
}

function updateFileNameDisplay() {
    const el = document.getElementById('currentFileNameDisplay');
    if (!el) return;
    
    if (currentFileHandle) {
        el.textContent = `📁 ${currentFileHandle.name}`;
        el.style.display = 'inline-block';
    } else {
        el.textContent = '';
        el.style.display = 'none';
    }
}

function loadDataFromString(jsonString) {
    const data = JSON.parse(jsonString);
    if (!data.profiles || !Array.isArray(data.profiles)) {
        throw new Error('無効なデータ形式です');
    }
    profiles = data.profiles;
    saveProfiles(); // localStorageにもバックアップとして保存
    
    if (profiles.length > 0) {
        switchProfile(profiles[0].id);
    } else {
        createDefaultProfile();
        switchProfile(profiles[0].id);
    }
    renderProfileSelector();
    renderTagUI();
}

async function openFile() {
    try {
        if (!window.showOpenFilePicker) {
            showNotification('お使いのブラウザはファイルアクセスに対応していません', 'error');
            return;
        }
        const [fileHandle] = await window.showOpenFilePicker({
            types: [{ description: 'JSON Files', accept: {'application/json': ['.json']} }]
        });
        
        if (!confirm('現在のデータはすべて上書きされます。よろしいですか？')) return;

        const file = await fileHandle.getFile();
        const text = await file.text();
        loadDataFromString(text);
        
        currentFileHandle = fileHandle;
        await storeFileHandle(fileHandle);
        updateFileNameDisplay();
        showNotification('データを読み込みました', 'success');
    } catch (e) {
        if (e.name !== 'AbortError') {
            console.error(e);
            showNotification('ファイルの読み込みに失敗しました: ' + e.message, 'error');
        }
    }
}

async function saveFile() {
    try {
        if (!currentFileHandle) {
            return saveAsFile();
        }
        
        if (!await verifyPermission(currentFileHandle, true)) {
            showNotification('ファイルへの書き込み権限がありません', 'error');
            return;
        }
        
        const writable = await currentFileHandle.createWritable();
        await writable.write(getDataString());
        await writable.close();
        
        showNotification('上書き保存しました', 'success');
    } catch (e) {
        console.error(e);
        showNotification('保存に失敗しました: ' + e.message, 'error');
    }
}

async function saveAsFile() {
    try {
        if (!window.showSaveFilePicker) {
            showNotification('お使いのブラウザはファイルアクセスに対応していません', 'error');
            return;
        }
        
        const now = new Date();
        const timestamp = now.getFullYear() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0') + '-' +
            String(now.getHours()).padStart(2, '0') +
            String(now.getMinutes()).padStart(2, '0');
        const defaultName = `combo-data-${timestamp}.json`;

        const fileHandle = await window.showSaveFilePicker({
            suggestedName: defaultName,
            types: [{ description: 'JSON Files', accept: {'application/json': ['.json']} }]
        });
        
        const writable = await fileHandle.createWritable();
        await writable.write(getDataString());
        await writable.close();
        
        currentFileHandle = fileHandle;
        await storeFileHandle(fileHandle);
        showNotification('別名で保存しました', 'success');
    } catch (e) {
        if (e.name !== 'AbortError') {
            console.error(e);
            showNotification('保存に失敗しました: ' + e.message, 'error');
        }
    }
}

async function tryAutoLoad() {
    try {
        const handle = await getStoredFileHandle();
        if (handle) {
            // 自動読み込み時は、ブラウザがユーザーに権限要求のダイアログを出します
            // ユーザーが拒否した場合は例外が発生し無視されます
            const hasPermission = await verifyPermission(handle, true);
            if (hasPermission) {
                const file = await handle.getFile();
                const text = await file.text();
                loadDataFromString(text);
                currentFileHandle = handle;
                showNotification('設定されたファイルから自動でデータを読み込みました', 'success');
            }
        }
    } catch (e) {
        console.log("Auto load aborted or failed:", e);
    }
}

function showHelpModal() {
    const title = '使い方ガイド';
    const bodyHTML = `
        <div style="font-family: 'Inter', sans-serif; line-height: 1.6; color: var(--color-text-primary);">
            <h4 style="color: var(--color-accent-secondary); margin-bottom: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.2rem;">基本操作</h4>
            <ul style="list-style: disc; padding-left: 1.2rem; margin-bottom: 1rem;">
                <li><strong>キャラクター作成</strong>: 「新規キャラクター」からゲーム・キャラごとにデータを作成します。既存キャラの技を引き継ぐこともできます。</li>
                <li><strong>技の追加</strong>: 通常技、必殺技などの「➕」ボタンから技を登録します。</li>
            </ul>

            <h4 style="color: var(--color-accent-secondary); margin-bottom: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.2rem;">コンボの作成・編集</h4>
            <ul style="list-style: disc; padding-left: 1.2rem; margin-bottom: 1rem;">
                <li><strong>コンボ作成</strong>: 登録した技ボタンをクリックすると、コンボに追加されます。</li>
                <li><strong>途中挿入</strong>: トークン間の「+」をクリックし、技や接続タイプなどを選ぶと、その場所に挿入できます。</li>
                <li><strong>テキストモード</strong>: 「テキストモード」に切り替えると、文字入力でまとめて編集できます。</li>
            </ul>

            <h4 style="color: var(--color-accent-secondary); margin-bottom: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.2rem;">データの保存と読み込み (.json)</h4>
            <ul style="list-style: disc; padding-left: 1.2rem; margin-bottom: 0;">
                <li>データはブラウザにも<strong>一時保存</strong>されますが、確実な保存のためにファイル保存をご利用ください。</li>
                <li>ヘッダーの「<strong>📝 別名で保存</strong>」で、データをパソコン上に <strong>.json拡張子のファイル</strong> として保存できます。</li>
                <li>「<strong>💾 上書き保存</strong>」で、現在開いている.jsonファイルに直接上書き保存します。</li>
                <li>「<strong>📂 開く</strong>」で、パソコン上の.jsonファイルを読み込みます。</li>
                <li>※「開く」または「別名で保存」したファイルは記憶され、次回ツールを開いた際に<strong>自動で読み込み</strong>を試みます（ブラウザの「許可」ダイアログが出た場合は許可してください）。</li>
            </ul>
        </div>
    `;

    showModal(title, bodyHTML);
}

// ============================================
// タグ管理ヘルパー
// ============================================
function getAllUniqueTags() {
    if (!currentProfile) return [];
    const tagsSet = new Set();
    currentProfile.combos.forEach(combo => {
        if (combo.tags) {
            combo.tags.forEach(tag => tagsSet.add(tag));
        }
    });
    return Array.from(tagsSet).sort();
}

function renderTagUI() {
    const tags = getAllUniqueTags();
    
    const container = document.getElementById('existingTagsContainer');
    if (container) {
        if (tags.length === 0) {
            container.innerHTML = '<span style="font-size: 0.8rem; color: var(--color-text-muted);">登録されているタグはありません</span>';
        } else {
            container.innerHTML = tags.map(tag => 
                `<button class="combo-tag btn-secondary" style="cursor: pointer; padding: 2px 8px; border: none; font-size: 0.8rem; border-radius: 4px;" type="button" data-tag="${tag}">${tag} +</button>`
            ).join('');
        }
    }
    
    const filterContainer = document.getElementById('comboTagFilterContainer');
    if (filterContainer) {
        if (tags.length === 0) {
            filterContainer.innerHTML = '<span style="font-size: 0.8rem; color: var(--color-text-muted);">タグはありません</span>';
        } else {
            // 現在の選択状態を維持しつつ再描画
            filterContainer.innerHTML = tags.map(tag => {
                const checked = selectedFilterTags.has(tag) ? 'checked' : '';
                const id = `tagcb_${tag.replace(/[^a-zA-Z0-9]/g, '_')}`;
                return `
                    <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 0.82rem; color: var(--color-text-primary); padding: 2px 0;" for="${id}">
                        <input type="checkbox" id="${id}" data-tag="${tag}" ${checked} style="cursor: pointer; accent-color: var(--color-accent-secondary);">
                        <span class="combo-tag" style="padding: 1px 6px; font-size: 0.78rem;">${tag}</span>
                    </label>
                `;
            }).join('');
        }
    }

    updateClearAllTagsBtnVisibility();
}

function updateClearAllTagsBtnVisibility() {
    const btn = document.getElementById('clearAllTagsBtn');
    if (btn) {
        btn.style.display = selectedFilterTags.size > 0 ? 'inline-flex' : 'none';
    }
}

// ============================================
// ユーティリティ
// ============================================

function generateId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function showNotification(message, type = 'info') {
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${type === 'success' ? 'var(--gradient-secondary)' :
            type === 'error' ? 'var(--gradient-primary)' :
                'rgba(255, 255, 255, 0.2)'};
        color: white;
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-lg);
        z-index: 10000;
        font-weight: 600;
        animation: slideInRight 0.3s ease;
        backdrop-filter: blur(10px);
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            opacity: 0;
            transform: translateX(100px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    @keyframes slideOutRight {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100px);
        }
    }
`;
document.head.appendChild(style);

// ============================================
// 追加機能: 上書き保存とテキスト出力
// ============================================

function updateLoadedCombo() {
    if (!currentProfile || !loadedComboId) return;
    
    const combo = currentProfile.combos.find(c => c.id === loadedComboId);
    if (!combo) return;

    if (comboTokens.length === 0) {
        showNotification('コンボが空です', 'error');
        return;
    }

    const nameInput = document.getElementById('currentComboName');
    if (nameInput) {
        const name = nameInput.value.trim();
        const damage = document.getElementById('currentComboDamage').value.trim();
        const notes = document.getElementById('currentComboNotes').value.trim();

        if (!name) {
            showNotification('コンボ名を入力してください', 'error');
            return;
        }

        combo.name = name;
        combo.damage = parseInt(damage) || 0;
        combo.notes = notes;
        
        const tagsInput = document.getElementById('currentComboTags');
        if (tagsInput) {
            combo.tags = tagsInput.value.split(',').map(t => t.trim()).filter(t => t);
        }
    }

    combo.tokens = JSON.parse(JSON.stringify(comboTokens));
    combo.displayString = generateDisplayString(comboTokens);
    combo.updatedAt = new Date().toISOString();

    saveProfiles();
    renderComboLibrary();
    renderTagUI();
    showNotification('コンボを上書き保存しました', 'success');
}

function updateComboBtnVisibility() {
    const btn = document.getElementById('updateComboBtn');
    if (btn) {
        if (loadedComboId) {
            btn.style.display = 'inline-flex';
        } else {
            btn.style.display = 'none';
        }
    }
}

function exportSelectedCombosText() {
    if (!currentProfile) return;

    const checkboxes = document.querySelectorAll('.combo-select-cb:checked');
    if (checkboxes.length === 0) {
        showNotification('コンボが選択されていません', 'error');
        return;
    }

    const selectedIds = Array.from(checkboxes).map(cb => cb.dataset.comboId);
    
    // 現在のリスト表示順（ソート・検索込み）に従って出力するのが直感的
    const listItems = document.querySelectorAll('.combo-item');
    const orderedIds = Array.from(listItems)
        .map(item => item.dataset.comboId)
        .filter(id => selectedIds.includes(id));

    const selectedCombos = orderedIds.map(id => currentProfile.combos.find(c => c.id === id));

    let exportText = '';
    selectedCombos.forEach((combo, index) => {
        exportText += `${combo.name}\n`;
        if (combo.damage > 0) exportText += `ダメージ: ${combo.damage}\n`;
        if (combo.tags && combo.tags.length > 0) exportText += `タグ: ${combo.tags.join(', ')}\n`;
        exportText += `${combo.displayString}\n`;
        if (combo.notes) exportText += `メモ: ${combo.notes}\n`;
        
        // コンボ間は改行により１行間隔を開ける
        if (index < selectedCombos.length - 1) {
            exportText += '\n\n';
        }
    });

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(exportText).then(() => {
            showNotification(`${selectedCombos.length}件のコンボをコピーしました`, 'success');
            // 全選択チェックボックスの解除
            const selectAll = document.getElementById('selectAllCombos');
            if(selectAll) selectAll.checked = false;
            document.querySelectorAll('.combo-select-cb').forEach(cb => cb.checked = false);
        }).catch(err => {
            console.error('コピーに失敗しました', err);
            showFallbackExportModal(exportText);
        });
    } else {
        // クリップボードAPIが使えない場合（ローカルファイル実行時など）
        showFallbackExportModal(exportText);
    }
}

function showFallbackExportModal(text) {
    const bodyHTML = `
        <p style="margin-bottom: 1rem; color: var(--color-text-secondary); font-size: 0.9rem;">
            テキストをコピーしてください:
        </p>
        <textarea class="form-textarea" style="height: 300px; width: 100%; resize: vertical;" readonly id="exportTextArea">${text}</textarea>
    `;
    showModal('テキスト出力', bodyHTML, () => true);
    
    // 少し遅延させてから選択状態にする
    setTimeout(() => {
        const textarea = document.getElementById('exportTextArea');
        if (textarea) {
            textarea.select();
        }
    }, 100);
}


