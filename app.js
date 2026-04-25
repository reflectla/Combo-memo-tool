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
    { id: "delay", symbol: "(dl)", label: "delay", position: "suffix" }
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
// ヘルパー関数
// ============================================

/**
 * HTML文字列をエスケープしてXSSを防止する
 * @param {string} str 
 * @returns {string}
 */
function escapeHTML(str) {
    if (typeof str !== 'string') return str === null || str === undefined ? '' : String(str);
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

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
        iconUrl: "",
        moves: JSON.parse(JSON.stringify(defaultMoves)),
        linkTypes: JSON.parse(JSON.stringify(defaultLinkTypes)),
        modifiers: JSON.parse(JSON.stringify(defaultModifiers)),
        resourceDefinitions: [],
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
    document.getElementById('manualBtn').addEventListener('click', showManualModal);
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
    document.getElementById('prefixModifierToggleBar').addEventListener('click', () => toggleModifierGroup('prefix'));
    document.getElementById('suffixModifierToggleBar').addEventListener('click', () => toggleModifierGroup('suffix'));

    // エクスポート/インポート/ヘルプ
    document.getElementById('helpBtn').addEventListener('click', showHelpModal);
    document.getElementById('saveFileBtn').addEventListener('click', saveFile);
    document.getElementById('saveAsFileBtn').addEventListener('click', saveAsFile);
    document.getElementById('openFileBtn').addEventListener('click', openFile);
    document.getElementById('exportImageBtn').addEventListener('click', exportComboAsImage);
}

// ============================================
// キャラクター（旧プロファイル）管理
// ============================================

function createProfile(gameName, characterName, baseProfileId = null, iconUrl = '') {
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
        iconUrl,
        moves,
        linkTypes,
        modifiers,
        resourceDefinitions: [],
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
    profile.iconUrl = data.iconUrl || '';
    if (data.resourceDefinitions) {
        profile.resourceDefinitions = data.resourceDefinitions;
    }

    saveProfiles();
    renderProfileSelector();

    if (currentProfileId === profileId) {
        currentProfile = profile;
        updateProfileIcon();
        renderResourceInputs();
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

function switchProfile(profileId, forceReset = true) {
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return;

    const isSameProfile = (currentProfileId === profileId);
    currentProfileId = profileId;
    currentProfile = profile;
    normalizeProfileData(currentProfile);
    localStorage.setItem('lastProfileId', profileId);
    
    if (forceReset && !isSameProfile) {
        comboTokens = [];
        loadedComboId = null;
        selectedFilterTags = new Set();
        
        const nameInput = document.getElementById('currentComboName');
        if (nameInput) {
            nameInput.value = '';
            document.getElementById('currentComboDamage').value = '';
            document.getElementById('currentComboNotes').value = '';
            const tagsInput = document.getElementById('currentComboTags');
            if (tagsInput) tagsInput.value = '';
        }
    }

    if (typeof updateComboBtnVisibility === 'function') updateComboBtnVisibility();

    document.getElementById('profileSelect').value = profileId;

    renderMoveButtons();
    renderLinkButtons();
    renderModifierButtons();
    renderComboLibrary();
    renderTagUI();
    renderResourceInputs();
    updateComboDisplay();
    updateProfileIcon();
}

function updateProfileIcon() {
    const container = document.getElementById('currentProfileIconContainer');
    if (!container) return;

    if (currentProfile && currentProfile.iconUrl) {
        // アイコンURLはエスケープして属性に入れる
        const safeUrl = escapeHTML(currentProfile.iconUrl);
        const safeName = escapeHTML(currentProfile.characterName);
        container.innerHTML = `<img src="${safeUrl}" alt="${safeName}">`;
    } else {
        container.innerHTML = '<span class="empty-icon-placeholder">👤</span>';
    }
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

function addModifierType(symbol, label, position = 'suffix') {
    if (!currentProfile) return;

    const modifier = {
        id: generateId(),
        symbol,
        label,
        position
    };

    currentProfile.modifiers.push(modifier);
    saveProfiles();
    renderModifierButtons();
    showNotification('修飾子を追加しました', 'success');
}

function updateModifierType(id, symbol, label, position) {
    if (!currentProfile) return;

    const modifier = currentProfile.modifiers.find(m => m.id === id);
    if (!modifier) return;

    modifier.symbol = symbol;
    modifier.label = label;
    modifier.position = position || modifier.position || 'suffix';

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
    const safeId = escapeHTML(move.id);
    const safeCategory = escapeHTML(move.category);
    const safeDisplayName = escapeHTML(move.displayName);
    const safeNotation = escapeHTML(move.notation);

    return `
        <div class="move-btn" data-move-id="${safeId}" data-category="${safeCategory}" draggable="true" role="button" tabindex="0">
            <div class="move-btn-content">
                <span class="move-name">${safeDisplayName}</span>
                <span class="move-notation">${safeNotation}</span>
            </div>
            <div class="move-btn-actions">
                <button class="btn-icon-small edit-move-btn" data-move-id="${safeId}" title="編集">✏️</button>
                <button class="btn-icon-small clone-move-btn" data-move-id="${safeId}" title="コピーして新規作成">📄</button>
                <button class="btn-icon-small btn-danger delete-move-btn" data-move-id="${safeId}" title="削除">🗑️</button>
            </div>
        </div>
    `;
}

function renderLinkButtons() {
    if (!currentProfile) return;

    const container = document.getElementById('linkButtons');
    container.innerHTML = currentProfile.linkTypes.map(linkType => {
        const safeId = escapeHTML(linkType.id);
        const safeSymbol = escapeHTML(linkType.symbol);
        const safeLabel = escapeHTML(linkType.label);
        const isActive = currentLinkType === linkType.id ? 'active' : '';

        return `
            <div class="link-btn ${isActive}" data-link="${safeId}" role="button" tabindex="0">
                <div class="link-btn-content">
                    <span class="link-symbol">${safeSymbol}</span>
                    <span class="link-label" style="font-size: 0.8rem;">${safeLabel}</span>
                </div>
                <div class="move-btn-actions">
                    <button class="btn-icon-small edit-link-btn" data-link-id="${safeId}" title="編集">✏️</button>
                    <button class="btn-icon-small btn-danger delete-link-btn" data-link-id="${safeId}" title="削除">🗑️</button>
                </div>
            </div>
        `;
    }).join('');

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

    const prefixContainer = document.getElementById('prefixModifierButtons');
    const suffixContainer = document.getElementById('suffixModifierButtons');
    if (!prefixContainer || !suffixContainer) return;

    const buildModifierHtml = (modifier) => {
        const safeId = escapeHTML(modifier.id);
        const safeSymbol = escapeHTML(modifier.symbol);
        const safeLabel = escapeHTML(modifier.label);
        return `
            <div class="modifier-btn" data-modifier="${safeId}" role="button" tabindex="0">
                <div class="modifier-btn-content">
                    <span class="modifier-symbol">${safeSymbol}</span>
                    <span class="modifier-label" style="font-size: 0.8rem;">${safeLabel}</span>
                </div>
                <div class="move-btn-actions">
                    <button class="btn-icon-small edit-modifier-btn" data-modifier-id="${safeId}" title="編集">✏️</button>
                    <button class="btn-icon-small btn-danger delete-modifier-btn" data-modifier-id="${safeId}" title="削除">🗑️</button>
                </div>
            </div>
        `;
    };

    const prefixModifiers = currentProfile.modifiers.filter(m => (m.position || 'suffix') === 'prefix');
    const suffixModifiers = currentProfile.modifiers.filter(m => (m.position || 'suffix') === 'suffix');
    const emptyHtml = '<span style="font-size: 0.8rem; color: var(--color-text-muted);">登録なし</span>';

    prefixContainer.innerHTML = prefixModifiers.length > 0 ? prefixModifiers.map(buildModifierHtml).join('') : emptyHtml;
    suffixContainer.innerHTML = suffixModifiers.length > 0 ? suffixModifiers.map(buildModifierHtml).join('') : emptyHtml;

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
    const modifier = currentProfile.modifiers.find(m => m.id === modifierId);
    if (!modifier) return;
    const modifierPosition = modifier.position || 'suffix';

    if (comboTokens.length === 0) {
        comboTokens.push({
            type: 'modifier',
            kind: modifierId
        });
    } else {
        const lastToken = comboTokens[comboTokens.length - 1];
        if (lastToken.type !== 'move' && lastToken.type !== 'link' && lastToken.type !== 'modifier') return;

        // 前置修飾子は「次の技側のブロック」に属するため、
        // 直前が技/後置修飾子なら接続タイプを挟んでブロックを分ける
        if (modifierPosition === 'prefix') {
            const lastModifier = lastToken.type === 'modifier'
                ? currentProfile.modifiers.find(m => m.id === lastToken.kind)
                : null;
            const lastModifierPosition = lastModifier ? (lastModifier.position || 'suffix') : null;
            const shouldInsertLink = lastToken.type === 'move' || (lastToken.type === 'modifier' && lastModifierPosition === 'suffix');
            if (shouldInsertLink) {
                comboTokens.push({
                    type: 'link',
                    kind: currentLinkType
                });
            }
        }

        comboTokens.push({
            type: 'modifier',
            kind: modifierId
        });
    }

    updateComboDisplay();
    autoSave();
}

function insertModifierAt(index, modifierId) {
    const modifier = currentProfile.modifiers.find(m => m.id === modifierId);
    if (!modifier) return index;
    const modifierPosition = modifier.position || 'suffix';

    // 修飾子は move, link, または modifier の後にのみ挿入可能
    // ただし index が 0 の場合（先頭）は許可する
    if (index > 0) {
        const prevToken = comboTokens[index - 1];
        if (prevToken.type !== 'move' && prevToken.type !== 'link' && prevToken.type !== 'modifier') return index;
    }

    const tokensToInsert = [];
    if (modifierPosition === 'prefix' && index > 0) {
        const prevToken = comboTokens[index - 1];
        const prevModifier = prevToken.type === 'modifier'
            ? currentProfile.modifiers.find(m => m.id === prevToken.kind)
            : null;
        const prevModifierPosition = prevModifier ? (prevModifier.position || 'suffix') : null;
        const shouldInsertLink = prevToken.type === 'move' || (prevToken.type === 'modifier' && prevModifierPosition === 'suffix');
        if (shouldInsertLink) {
            tokensToInsert.push({ type: 'link', kind: currentLinkType });
        }
    }

    tokensToInsert.push({
        type: 'modifier',
        kind: modifierId
    });

    comboTokens.splice(index, 0, ...tokensToInsert);

    insertPosition = index + tokensToInsert.length;
    updateComboDisplay();
    autoSave();
    return insertPosition;
}

function insertLinkTypeAt(index, linkId) {
    // 先頭が接続タイプだけになる状態を防ぐ（技が1つ以上ある時のみ挿入可能）
    const hasMoveToken = comboTokens.some(token => token.type === 'move');
    if (!hasMoveToken) return index;

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
    // link は「前後ともに move か modifier がある」場合のみ有効とする
    comboTokens = comboTokens.filter((token, i, arr) => {
        if (token.type !== 'link') return true;
        const prev = arr[i - 1];
        const next = arr[i + 1];
        const validPrev = prev && (prev.type === 'move' || prev.type === 'modifier');
        const validNext = next && (next.type === 'move' || next.type === 'modifier');
        return validPrev && validNext;
    });

    if (comboTokens.length === 0) {
        insertPosition = null;
    } else if (insertPosition !== null) {
        insertPosition = Math.min(insertPosition, comboTokens.length);
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

        // 現在のコンボをテキストエリアに設定 (プレーンテキスト)
        const displayString = generateDisplayString(comboTokens, null, false);
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
    const entries = [];
    const normalizeForParsing = (value) => {
        if (typeof value !== 'string') return '';
        // NFKC で全角英数字・記号揺れを吸収し、さらに大小文字差を吸収
        return value.normalize('NFKC').toLowerCase().replace(/＞/g, '>');
    };

    // 接続タイプ
    currentProfile.linkTypes.forEach(linkType => {
        if (!linkType.symbol) return;
        entries.push({
            kind: 'link',
            value: linkType.symbol,
            normalizedValue: normalizeForParsing(linkType.symbol),
            token: { type: 'link', kind: linkType.id }
        });
    });

    // 修飾子 (表記 / ID)
    currentProfile.modifiers.forEach(modifier => {
        [modifier.symbol, modifier.label].forEach(v => {
            if (!v) return;
            entries.push({
                kind: 'modifier',
                value: v,
                normalizedValue: normalizeForParsing(v),
                token: { type: 'modifier', kind: modifier.id }
            });
        });
    });

    // 技（表示 / コマンド / ID）
    currentProfile.moves.forEach(move => {
        [move.displayName, move.notation, move.id].forEach(v => {
            if (!v) return;
            entries.push({
                kind: 'move',
                value: v,
                normalizedValue: normalizeForParsing(v),
                token: { type: 'move', id: move.id }
            });
        });
    });

    // 長い文字列を優先してマッチ（例: xx と x が共存する場合）
    entries.sort((a, b) => b.value.length - a.value.length);

    const normalizedText = normalizeForParsing(text);
    let i = 0;
    while (i < text.length) {
        if (/\s/.test(text[i])) {
            i++;
            continue;
        }

        let matched = null;

        // 注釈 (数字+hit/ヒット または (数字 hit)) のパターンを優先
        const annotationMatch = normalizedText.slice(i).match(/^(\d+)(hit|ヒット)|^\((\d+)\s*hit\)/);
        if (annotationMatch) {
            const val = annotationMatch[1] || annotationMatch[3];
            tokens.push({ type: 'annotation', value: val });
            i += annotationMatch[0].length;
            continue;
        }

        for (const entry of entries) {
            if (normalizedText.startsWith(entry.normalizedValue, i)) {
                matched = entry;
                break;
            }
        }

        if (!matched) {
            // 不明トークンは次の空白まで切り出してエラー表示
            let j = i;
            while (j < text.length && !/\s/.test(text[j])) j++;
            throw new Error(`不明な要素: ${text.slice(i, j)}`);
        }

        tokens.push({ ...matched.token });
        i += matched.value.length;
    }

    const getModifierPosition = (token) => {
        if (!token || token.type !== 'modifier') return null;
        const modifier = currentProfile.modifiers.find(m => m.id === token.kind);
        return modifier ? (modifier.position || 'suffix') : 'suffix';
    };

    const shouldInsertLinkBetween = (prev, current) => {
        if (!prev || !current) return false;
        if (prev.type === 'link' || current.type === 'link') return false;

        // annotation が絡む場合
        if (prev.type === 'annotation') {
            if (current.type === 'move') return true;
            if (current.type === 'modifier' && getModifierPosition(current) === 'prefix') return true;
        }
        if (current.type === 'annotation') return false;

        const prevModifierPos = getModifierPosition(prev);
        const currentModifierPos = getModifierPosition(current);

        // move の直後
        if (prev.type === 'move') {
            if (current.type === 'move') return true;
            if (current.type === 'modifier') {
                // 後置は同ブロック、前置は次ブロック開始
                return currentModifierPos === 'prefix';
            }
        }

        // modifier の直後
        if (prev.type === 'modifier') {
            if (prevModifierPos === 'suffix') {
                if (current.type === 'move') return true; // 後置の次の技は別ブロック
                if (current.type === 'modifier') {
                    return currentModifierPos === 'prefix'; // suffix->suffix は同ブロック
                }
            }

            if (prevModifierPos === 'prefix') {
                if (current.type === 'move') return false; // 前置の後ろ技は同ブロック
                if (current.type === 'modifier') return currentModifierPos === 'suffix';
                // prefix->prefix は同ブロック（まとめて後ろの技に掛ける）
            }
        }

        return false;
    };

    // move/modifier の並びから、ブロック境界に現在選択中の接続タイプを自動補完
    const autoLinkedTokens = [];
    for (const token of tokens) {
        const prev = autoLinkedTokens[autoLinkedTokens.length - 1];
        if (shouldInsertLinkBetween(prev, token)) {
            autoLinkedTokens.push({ type: 'link', kind: currentLinkType });
        }
        autoLinkedTokens.push(token);
    }

    return autoLinkedTokens;
}

// ============================================
// 表示更新
// ============================================

function updateComboDisplay() {
    const displayElement = document.getElementById('comboDisplay');
    const tokensElement = document.getElementById('comboTokens');

    if (comboTokens.length === 0) {
        insertPosition = null;
        displayElement.classList.add('is-empty');
        displayElement.innerHTML = `
            <span class="combo-empty-message">技を選択してコンボを作成してください</span>
        `;
        tokensElement.innerHTML = '';
        return;
    }

    displayElement.classList.remove('is-empty');
    const displayString = generateDisplayString(comboTokens, insertPosition, true);
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


function generateDisplayString(tokens, cursorIndex = null, asHTML = false) {
    if (!currentProfile) return '';

    const shouldShowCursor = asHTML && cursorIndex !== null;
    const effectiveCursorIndex = shouldShowCursor ? cursorIndex : -1;
    let result = '';

    for (let i = 0; i <= tokens.length; i++) {
        // 挿入位置が指定されているときだけカーソル表示
        if (shouldShowCursor && i === effectiveCursorIndex) {
            result += '<span class="combo-cursor"></span>';
        }

        if (i < tokens.length) {
            if (i > 0) result += ' ';
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
                case 'annotation':
                    content = `(${token.value} hit)`;
                    break;
            }
            result += asHTML ? escapeHTML(content) : content;
        }
    }

    return result;
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
        case 'annotation':
            className += ' annotation';
            content = `(${token.value} hit)`;
            break;
    }

    return `
        <button class="token-insert" data-index="${index}" title="ここに挿入">+</button>
        <div class="${className}" draggable="true" data-index="${index}">
            <span>${escapeHTML(content)}</span>
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

    // 名前重複チェック
    if (currentProfile.combos.some(c => c.name === name)) {
        showNotification(`「${name}」という名前のコンボは既に存在します`, 'error');
        return;
    }

    const combo = {
        id: generateId(),
        name,
        damage: parseInt(damage) || 0,
        tokens: JSON.parse(JSON.stringify(comboTokens)),
        displayString: generateDisplayString(comboTokens, null, false),
        tags: tags ? tags.split(',').map(t => t.trim()).filter(t => t) : [],
        notes: notes || '',
        resources: getResourceDataFromUI(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    currentProfile.combos.push(combo);
    saveProfiles();
    renderComboLibrary();
    renderTagUI();
    renderResourceInputs();
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
        
        // リソースデータの復元
        if (currentProfile.resourceDefinitions) {
            currentProfile.resourceDefinitions.forEach(def => {
                const consumedInput = document.getElementById(`res_${def.id}_consumed`);
                const gainedInput = document.getElementById(`res_${def.id}_gained`);
                const requiredInput = document.getElementById(`res_${def.id}_required`);
                
                if (consumedInput) consumedInput.value = '';
                if (gainedInput) gainedInput.value = '';
                if (requiredInput) requiredInput.value = '';

                if (combo.resources && combo.resources[def.id]) {
                    const data = combo.resources[def.id];
                    if (consumedInput) consumedInput.value = data.consumed || '';
                    if (gainedInput) gainedInput.value = data.gained || '';
                    if (requiredInput) requiredInput.value = data.required || '';
                }
            });
        }
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

    // タグフィルター
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

        const safeId = escapeHTML(combo.id);
        const safeName = escapeHTML(combo.name);
        const safeDamage = escapeHTML(combo.damage);
        const safeDisplayString = escapeHTML(combo.displayString);

        return `
        <div class="combo-item" data-combo-id="${safeId}">
            <div class="combo-item-header">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <input type="checkbox" class="combo-select-cb" data-combo-id="${safeId}" style="cursor: pointer;" onclick="event.stopPropagation()">
                    <span class="combo-item-name">${safeName}</span>
                </div>
                <span class="combo-item-damage">${safeDamage}</span>
            </div>
            <div class="combo-item-string">${safeDisplayString}</div>
            ${combo.tags.length > 0 ? `
                <div class="combo-item-tags">
                    ${combo.tags.map(tag => `<span class="combo-tag">${escapeHTML(tag)}</span>`).join('')}
                </div>
            ` : ''}
            <div class="combo-item-actions">
                <button class="btn-icon-small load-combo-btn" data-combo-id="${safeId}" title="読み込み">📂</button>
                <button class="btn-icon-small edit-combo-btn" data-combo-id="${safeId}" title="編集">✏️</button>
                <button class="btn-icon-small btn-danger delete-combo-btn" data-combo-id="${safeId}" title="削除">🗑️</button>
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
// リソース（ゲージ）管理
// ============================================

function renderResourceInputs() {
    const container = document.getElementById('comboResourceInputs');
    if (!container || !currentProfile) return;

    const defs = currentProfile.resourceDefinitions || [];
    if (defs.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'flex';
    container.innerHTML = defs.map(def => {
        const safeId = escapeHTML(def.id);
        const safeName = escapeHTML(def.name);
        const safeColor = escapeHTML(def.color || 'var(--color-accent-secondary)');
        return `
            <div class="resource-input-group" style="padding: 0.5rem; border-left: 3px solid ${safeColor}; background: rgba(0,0,0,0.2); border-radius: 4px;">
                <div style="font-size: 0.75rem; font-weight: bold; margin-bottom: 0.4rem; color: ${safeColor};">${safeName}</div>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <div class="field">
                        <span style="font-size: 0.7rem; color: var(--color-text-muted);">消費</span>
                        <input type="number" id="res_${safeId}_consumed" class="form-input" style="width: 60px; padding: 2px 5px; font-size: 0.85rem;" placeholder="未設定">
                    </div>
                    ${def.showGain ? `
                    <div class="field">
                        <span style="font-size: 0.7rem; color: var(--color-text-muted);">獲得</span>
                        <input type="number" id="res_${safeId}_gained" class="form-input" style="width: 60px; padding: 2px 5px; font-size: 0.85rem;" placeholder="未設定">
                    </div>` : ''}
                    ${def.showRequired ? `
                    <div class="field">
                        <span style="font-size: 0.7rem; color: var(--color-text-muted);">必要</span>
                        <input type="number" id="res_${safeId}_required" class="form-input" style="width: 60px; padding: 2px 5px; font-size: 0.85rem;" placeholder="未設定">
                    </div>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function getResourceDataFromUI() {
    if (!currentProfile) return {};
    const data = {};
    (currentProfile.resourceDefinitions || []).forEach(def => {
        data[def.id] = {
            consumed: parseFloat(document.getElementById(`res_${def.id}_consumed`)?.value) || 0,
            gained: parseFloat(document.getElementById(`res_${def.id}_gained`)?.value) || 0,
            required: parseFloat(document.getElementById(`res_${def.id}_required`)?.value) || 0
        };
    });
    return data;
}

// ============================================
// モーダル
// ============================================

function showModal(title, bodyHTML, onConfirm) {
    const overlay = document.getElementById('modalOverlay');
    const container = document.getElementById('modalContainer');

    container.innerHTML = `
        <div class="modal-header">
            <h3 class="modal-title">${escapeHTML(title)}</h3>
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
            <input type="text" class="form-input" id="gameNameInput" value="${profile ? escapeHTML(profile.gameName) : ''}" placeholder="例: ストリートファイター6">
        </div>
        <div class="form-group">
            <label class="form-label">キャラクター名</label>
            <input type="text" class="form-input" id="characterNameInput" value="${profile ? escapeHTML(profile.characterName) : ''}" placeholder="例: リュウ">
        </div>
        <div class="form-group">
            <label class="form-label">キャラクターアイコン (任意)</label>
            <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;">
                <input type="text" class="form-input" id="profileIconInput" value="${profile ? escapeHTML(profile.iconUrl || '') : ''}" placeholder="URLまたはアップロード..." style="flex: 1;">
                <label class="btn btn-secondary" style="margin: 0; cursor: pointer; white-space: nowrap;">
                    📁 アップロード
                    <input type="file" id="iconFileInput" accept="image/*" style="display: none;">
                </label>
            </div>
            <div id="iconPreview" class="profile-modal-icon-preview">
                ${profile && profile.iconUrl ? `<img src="${escapeHTML(profile.iconUrl)}" alt="Preview">` : '<span class="empty-icon-placeholder">No Icon</span>'}
            </div>
            <div style="margin-top: 10px; font-size: 0.75rem; color: var(--color-text-muted); line-height: 1.5; padding: 8px; background: rgba(255,255,255,0.03); border-radius: 6px;">
                <p style="margin-bottom: 4px;">※URL指定の場合、元サイトの制限（CORS）により、画像保存時にアイコンが表示されないことがあります。その場合はアップロードをご利用ください。</p>
                <p>※アップロード目安: 1MB以内の正方形に近い画像（自動リサイズされます）</p>
            </div>
        </div>

        <div class="form-group">
            <label class="form-label">リソース（ゲージ）定義</label>
            <div id="resourceDefinitionsList" style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.5rem;">
                <!-- リソースリスト -->
            </div>
            <button type="button" class="btn btn-secondary" id="addNewResourceBtn" style="width: 100%; font-size: 0.85rem;">
                ➕ 新しいゲージを追加
            </button>
        </div>

        ${mode === 'create' ? `
            <div class="form-group">
                <label class="form-label">引き継ぐキャラクター (任意)</label>
                <select class="form-input" id="inheritProfileSelect">
                    <option value="">完全新規（デフォルト技のみ）</option>
                    ${profiles.map(p => `<option value="${escapeHTML(p.id)}">${escapeHTML(p.gameName)} - ${escapeHTML(p.characterName)}</option>`).join('')}
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
        const iconUrl = document.getElementById('profileIconInput').value.trim();

        if (!gameName || !characterName) {
            showNotification('ゲーム名とキャラクター名を入力してください', 'error');
            return false;
        }

        const data = {
            gameName,
            characterName,
            iconUrl,
            resourceDefinitions: localResourceDefs
        };

        if (mode === 'create') {
            const inheritId = document.getElementById('inheritProfileSelect').value || null;
            createProfile(gameName, characterName, inheritId, iconUrl);
            const newProfile = profiles[profiles.length - 1];
            newProfile.resourceDefinitions = localResourceDefs;
            saveProfiles();
            switchProfile(newProfile.id);
        } else {
            updateProfile(profileId, data);
        }

        return true;
    });

    // プレビューのリアルタイム更新
    const updatePreview = (url) => {
        const preview = document.getElementById('iconPreview');
        if (url) {
            const safeUrl = escapeHTML(url);
            preview.innerHTML = `<img src="${safeUrl}" alt="Preview" onerror="this.parentElement.innerHTML='<span class=\'empty-icon-placeholder\'>Invalid URL</span>'">`;
        } else {
            preview.innerHTML = '<span class="empty-icon-placeholder">No Icon</span>';
        }
    };

    const iconInput = document.getElementById('profileIconInput');
    if (iconInput) iconInput.addEventListener('input', (e) => updatePreview(e.target.value.trim()));

    const fileInput = document.getElementById('iconFileInput');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (file.size > 1024 * 1024) {
                    showNotification('画像サイズは1MB以下にしてください', 'error');
                    return;
                }
                const reader = new FileReader();
                reader.onload = (event) => {
                    const base64 = event.target.result;
                    document.getElementById('profileIconInput').value = base64;
                    updatePreview(base64);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (mode === 'edit') {
        const delBtn = document.getElementById('deleteProfileBtn');
        if (delBtn) delBtn.addEventListener('click', () => {
            deleteProfile(profileId);
            closeModal();
        });
    }

    // リソース定義の管理
    let localResourceDefs = profile ? JSON.parse(JSON.stringify(profile.resourceDefinitions || [])) : [];

    const renderLocalResources = () => {
        const list = document.getElementById('resourceDefinitionsList');
        if (!list) return;
        if (localResourceDefs.length === 0) {
            list.innerHTML = '<span style="font-size: 0.85rem; color: var(--color-text-muted);">定義されたゲージはありません</span>';
            return;
        }
        list.innerHTML = localResourceDefs.map((res, idx) => {
            const safeName = escapeHTML(res.name);
            const safeColor = escapeHTML(res.color);
            return `
                <div style="background: rgba(255,255,255,0.05); padding: 0.8rem; border-radius: 8px; border-left: 4px solid ${safeColor}; margin-bottom: 0.5rem;">
                    <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;">
                        <input type="text" class="form-input res-name" data-idx="${idx}" value="${safeName}" placeholder="ゲージ名" style="flex: 2;">
                        <input type="color" class="res-color" data-idx="${idx}" value="${safeColor}" style="width: 40px; height: 40px; padding: 0; border: none; background: none; cursor: pointer;">
                        <button type="button" class="btn btn-danger btn-icon-small delete-res-btn" data-idx="${idx}">🗑️</button>
                    </div>
                    <div style="display: flex; gap: 1rem; font-size: 0.8rem;">
                        <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
                            <input type="checkbox" class="res-show-gain" data-idx="${idx}" ${res.showGain ? 'checked' : ''}> 獲得量も表示
                        </label>
                        <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
                            <input type="checkbox" class="res-show-required" data-idx="${idx}" ${res.showRequired ? 'checked' : ''}> 必要量も表示
                        </label>
                    </div>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.res-name').forEach(input => {
            input.addEventListener('input', (e) => localResourceDefs[e.target.dataset.idx].name = e.target.value);
        });
        list.querySelectorAll('.res-color').forEach(input => {
            input.addEventListener('input', (e) => {
                localResourceDefs[e.target.dataset.idx].color = e.target.value;
                e.target.closest('div').parentElement.style.borderLeftColor = e.target.value;
            });
        });
        list.querySelectorAll('.res-show-gain').forEach(input => {
            input.addEventListener('change', (e) => localResourceDefs[e.target.dataset.idx].showGain = e.target.checked);
        });
        list.querySelectorAll('.res-show-required').forEach(input => {
            input.addEventListener('change', (e) => localResourceDefs[e.target.dataset.idx].showRequired = e.target.checked);
        });
        list.querySelectorAll('.delete-res-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                localResourceDefs.splice(e.currentTarget.dataset.idx, 1);
                renderLocalResources();
            });
        });
    };

    const addResBtn = document.getElementById('addNewResourceBtn');
    if (addResBtn) {
        addResBtn.addEventListener('click', () => {
            localResourceDefs.push({
                id: generateId(),
                name: '新ゲージ',
                color: '#00d4ff',
                showGain: false,
                showRequired: false
            });
            renderLocalResources();
        });
    }

    renderLocalResources();
}

function showMoveModal(mode, moveId = null, category = 'normal') {
    const move = moveId ? currentProfile.moves.find(m => m.id === moveId) : null;
    const title = mode === 'create' ? '技を追加' : '技を編集';

    const bodyHTML = `
        <div class="form-group">
            <label class="form-label">表示</label>
            <input type="text" class="form-input" id="moveNameInput" value="${move ? escapeHTML(move.displayName) : ''}" placeholder="例: 立ち弱P">
        </div>
        <div class="form-group">
            <label class="form-label">コマンド</label>
            <input type="text" class="form-input" id="moveNotationInput" value="${move ? escapeHTML(move.notation) : ''}" placeholder="例: 5LP">
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
}

function showModifierModal(mode, modifierId = null) {
    const modifier = modifierId ? currentProfile.modifiers.find(m => m.id === modifierId) : null;
    const title = mode === 'create' ? '修飾子を追加' : '修飾子を編集';

    const bodyHTML = `
        <div class="form-group">
            <label class="form-label">表記</label>
            <input type="text" class="form-input" id="modifierSymbolInput" value="${modifier ? escapeHTML(modifier.symbol) : ''}" placeholder="例: (jc)">
        </div>
        <div class="form-group">
            <label class="form-label">ID</label>
            <input type="text" class="form-input" id="modifierLabelInput" value="${modifier ? escapeHTML(modifier.label) : ''}" placeholder="例: jc">
        </div>
        <div class="form-group">
            <label class="form-label">種類</label>
            <select class="form-input" id="modifierPositionInput">
                <option value="prefix" ${(modifier && (modifier.position || 'suffix') === 'prefix') ? 'selected' : ''}>前置修飾子</option>
                <option value="suffix" ${(!modifier || (modifier.position || 'suffix') === 'suffix') ? 'selected' : ''}>後置修飾子</option>
            </select>
        </div>
    `;

    showModal(title, bodyHTML, () => {
        const symbol = document.getElementById('modifierSymbolInput').value.trim();
        const label = document.getElementById('modifierLabelInput').value.trim();
        const position = document.getElementById('modifierPositionInput').value;

        if (!symbol || !label) {
            showNotification('すべての項目を入力してください', 'error');
            return false;
        }

        if (mode === 'create') {
            addModifierType(symbol, label, position);
        } else {
            updateModifierType(modifierId, symbol, label, position);
        }

        return true;
    });
}

function toggleModifierGroup(position) {
    const containerId = position === 'prefix' ? 'prefixModifierButtons' : 'suffixModifierButtons';
    const arrowId = position === 'prefix' ? 'prefixModifierArrow' : 'suffixModifierArrow';
    const container = document.getElementById(containerId);
    const arrow = document.getElementById(arrowId);
    if (!container || !arrow) return;

    const isOpen = container.classList.contains('modifier-group-open');
    if (isOpen) {
        container.classList.remove('modifier-group-open');
        arrow.textContent = '▶';
    } else {
        container.classList.add('modifier-group-open');
        arrow.textContent = '▼';
    }
}

function normalizeProfileData(profile) {
    if (!profile) return;
    if (!Array.isArray(profile.modifiers)) profile.modifiers = [];
    profile.modifiers = profile.modifiers.map(mod => ({
        ...mod,
        position: mod.position === 'prefix' ? 'prefix' : 'suffix'
    }));
    if (!Array.isArray(profile.resourceDefinitions)) profile.resourceDefinitions = [];
}

function showLinkModal(mode, linkId = null) {
    const linkType = linkId ? currentProfile.linkTypes.find(l => l.id === linkId) : null;
    const title = mode === 'create' ? '接続タイプを追加' : '接続タイプを編集';

    const bodyHTML = `
        <div class="form-group">
            <label class="form-label">記号</label>
            <input type="text" class="form-input" id="linkSymbolInput" value="${linkType ? escapeHTML(linkType.symbol) : ''}" placeholder="例: ~">
        </div>
        <div class="form-group">
            <label class="form-label">ラベル</label>
            <input type="text" class="form-input" id="linkLabelInput" value="${linkType ? escapeHTML(linkType.label) : ''}" placeholder="例: ホールド">
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
            <input type="text" class="form-input" id="comboNameInput" placeholder="例: 基本コンボ1" value="${escapeHTML(currentName)}">
        </div>
        <div class="form-group">
            <label class="form-label">ダメージ</label>
            <input type="number" class="form-input" id="comboDamageInput" placeholder="例: 250" value="${escapeHTML(currentDamage)}">
        </div>
        <div class="form-group">
            <label class="form-label">タグ（カンマ区切り）</label>
            <input type="text" class="form-input" id="comboTagsInput" placeholder="例: 初心者向け, 中央">
        </div>
        <div class="form-group">
            <label class="form-label">メモ</label>
            <textarea class="form-textarea" id="comboNotesInput" placeholder="コンボの説明やメモ">${escapeHTML(currentNotes)}</textarea>
        </div>
    `;

    showModal('別名で新規保存', bodyHTML, () => {
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
            <input type="text" class="form-input" id="comboNameInput" value="${escapeHTML(combo.name)}">
        </div>
        <div class="form-group">
            <label class="form-label">ダメージ</label>
            <input type="number" class="form-input" id="comboDamageInput" value="${escapeHTML(combo.damage)}">
        </div>
        <div class="form-group">
            <label class="form-label">タグ（カンマ区切り）</label>
            <input type="text" class="form-input" id="comboTagsInput" value="${escapeHTML(combo.tags.join(', '))}">
        </div>
        <div class="form-group">
            <label class="form-label">メモ</label>
            <textarea class="form-textarea" id="comboNotesInput">${escapeHTML(combo.notes)}</textarea>
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
    try {
        if ((await fileHandle.queryPermission(options)) === 'granted') {
            return true;
        }
        if ((await fileHandle.requestPermission(options)) === 'granted') {
            return true;
        }
    } catch (e) {
        console.error("Permission request failed", e);
    }
    return false;
}

function getDataString() {
    const data = {
        profiles: profiles,
        version: "1.1",
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
    saveProfiles();
    
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
                <li><strong>キャラクター作成</strong>: 「新規キャラクター」からゲーム・キャラごとにデータを作成します。</li>
                <li><strong>技の追加</strong>: 通常技、必殺技などの「➕」ボタンから技を登録します。</li>
                <li><strong>コンボ作成</strong>: 技ボタンを順番にクリックしてコンボを作成します。</li>
                <li><strong>保存</strong>: 「コンボメモに保存」でライブラリに追加されます。</li>
            </ul>
        </div>
    `;
    showModal(title, bodyHTML);
}

function showManualModal() {
    const title = '便利な仕様・マニュアル';
    const bodyHTML = `
        <div style="font-family: 'Inter', sans-serif; line-height: 1.6; color: var(--color-text-primary);">
            <h4 style="color: var(--color-accent-secondary); margin-bottom: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.2rem;">効率的な入力</h4>
            <ul style="list-style: disc; padding-left: 1.2rem; margin-bottom: 1rem;">
                <li><strong>テキストモード</strong>: 直接文字を打ってコンボを編集できます。</li>
                <li><strong>ドラッグ＆ドロップ</strong>: コンボ内の技を入れ替えたり、技ボタンの並びを変更できます。</li>
                <li><strong>挿入モード</strong>: 技と技の間の「+」をクリックすると、その位置に技を挿入できます。</li>
            </ul>
        </div>
    `;
    showModal(title, bodyHTML);
}

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
            container.innerHTML = tags.map(tag => {
                const safeTag = escapeHTML(tag);
                return `<button class="combo-tag btn-secondary" style="cursor: pointer; padding: 2px 8px; border: none; font-size: 0.8rem; border-radius: 4px;" type="button" data-tag="${safeTag}">${safeTag} +</button>`;
            }).join('');
        }
    }
    const filterContainer = document.getElementById('comboTagFilterContainer');
    if (filterContainer) {
        if (tags.length === 0) {
            filterContainer.innerHTML = '<span style="font-size: 0.8rem; color: var(--color-text-muted);">タグはありません</span>';
        } else {
            filterContainer.innerHTML = tags.map(tag => {
                const safeTag = escapeHTML(tag);
                const checked = selectedFilterTags.has(tag) ? 'checked' : '';
                const id = `tagcb_${safeTag.replace(/[^a-zA-Z0-9]/g, '_')}`;
                return `
                    <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 0.82rem; color: var(--color-text-primary); padding: 2px 0;" for="${id}">
                        <input type="checkbox" id="${id}" data-tag="${safeTag}" ${checked} style="cursor: pointer; accent-color: var(--color-accent-secondary);">
                        <span class="combo-tag" style="padding: 1px 6px; font-size: 0.78rem;">${safeTag}</span>
                    </label>
                `;
            }).join('');
        }
    }
    updateClearAllTagsBtnVisibility();
}

function updateClearAllTagsBtnVisibility() {
    const btn = document.getElementById('clearAllTagsBtn');
    if (btn) btn.style.display = selectedFilterTags.size > 0 ? 'inline-flex' : 'none';
}

function generateId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function showNotification(message, type = 'info') {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; padding: 1rem 1.5rem;
        background: ${type === 'success' ? 'var(--gradient-secondary)' : type === 'error' ? 'var(--gradient-primary)' : 'rgba(255, 255, 255, 0.2)'};
        color: white; border-radius: var(--radius-md); box-shadow: var(--shadow-lg); z-index: 10000; font-weight: 600;
        animation: slideInRight 0.3s ease; backdrop-filter: blur(10px);
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

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
        if (tagsInput) combo.tags = tagsInput.value.split(',').map(t => t.trim()).filter(t => t);
    }
    combo.tokens = JSON.parse(JSON.stringify(comboTokens));
    combo.displayString = generateDisplayString(comboTokens, null, false);
    combo.resources = getResourceDataFromUI();
    combo.updatedAt = new Date().toISOString();
    saveProfiles();
    renderComboLibrary();
    renderTagUI();
    showNotification('コンボを上書き保存しました', 'success');
}

function updateComboBtnVisibility() {
    const btn = document.getElementById('updateComboBtn');
    if (btn) btn.style.display = loadedComboId ? 'inline-flex' : 'none';
}

function exportSelectedCombosText() {
    if (!currentProfile) return;
    const checkboxes = document.querySelectorAll('.combo-select-cb:checked');
    if (checkboxes.length === 0) {
        showNotification('コンボが選択されていません', 'error');
        return;
    }
    const selectedIds = Array.from(checkboxes).map(cb => cb.dataset.comboId);
    const listItems = document.querySelectorAll('.combo-item');
    const orderedIds = Array.from(listItems).map(item => item.dataset.comboId).filter(id => selectedIds.includes(id));
    const selectedCombos = orderedIds.map(id => currentProfile.combos.find(c => c.id === id));
    let exportText = '';
    selectedCombos.forEach((combo, index) => {
        exportText += `${combo.name}\n`;
        if (combo.damage > 0) exportText += `ダメージ: ${combo.damage}\n`;
        if (combo.tags && combo.tags.length > 0) exportText += `タグ: ${combo.tags.join(', ')}\n`;
        
        // ゲージ（リソース）情報の追加
        if (combo.resources && currentProfile.resourceDefinitions) {
            const resourceParts = [];
            currentProfile.resourceDefinitions.forEach(def => {
                const resData = combo.resources[def.id];
                if (resData) {
                    const details = [];
                    if (resData.consumed) details.push(`消費${resData.consumed}`);
                    if (def.showRequired && resData.required) details.push(`必要${resData.required}`);
                    if (def.showGain && resData.gained) details.push(`獲得${resData.gained}`);
                    
                    if (details.length > 0) {
                        resourceParts.push(`${def.name}[${details.join('/')}]`);
                    }
                }
            });
            if (resourceParts.length > 0) {
                exportText += `ゲージ: ${resourceParts.join(' ')}\n`;
            }
        }

        exportText += `${combo.displayString}\n`;
        if (combo.notes) exportText += `メモ: ${combo.notes}\n`;
        if (index < selectedCombos.length - 1) exportText += '\n\n';
    });
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(exportText).then(() => {
            showNotification(`${selectedCombos.length}件のコンボをコピーしました`, 'success');
            const selectAll = document.getElementById('selectAllCombos');
            if(selectAll) selectAll.checked = false;
            document.querySelectorAll('.combo-select-cb').forEach(cb => cb.checked = false);
        }).catch(() => showFallbackExportModal(exportText));
    } else {
        showFallbackExportModal(exportText);
    }
}

function showFallbackExportModal(text) {
    const bodyHTML = `<p style="margin-bottom: 1rem; color: var(--color-text-secondary); font-size: 0.9rem;">テキストをコピーしてください:</p><textarea class="form-textarea" style="height: 300px; width: 100%;" readonly id="exportTextArea">${text}</textarea>`;
    showModal('テキスト出力', bodyHTML, () => true);
    setTimeout(() => document.getElementById('exportTextArea')?.select(), 100);
}

function exportComboAsImage() {
    if (!currentProfile) return;
    if (comboTokens.length === 0) {
        showNotification('コンボが空です', 'error');
        return;
    }

    const oldTemplate = document.getElementById('exportTemplate');
    if (oldTemplate) oldTemplate.remove();

    const template = document.createElement('div');
    template.id = 'exportTemplate';
    
    const comboName = document.getElementById('currentComboName').value.trim() || 'Untitled Combo';
    const damage = document.getElementById('currentComboDamage').value.trim() || '0';
    const tags = document.getElementById('currentComboTags') ? document.getElementById('currentComboTags').value.trim().split(',').filter(t => t) : [];
    // リソース情報の生成
    const resourceData = getResourceDataFromUI();
    const resourcesHtml = (currentProfile.resourceDefinitions || []).map(def => {
        const data = resourceData[def.id] || {};
        // 全て0なら表示しない
        if (!data.consumed && !data.gained && !data.required) return '';
        
        let details = [];
        const labelStyle = 'font-size: 0.65rem; color: var(--color-text-muted); margin-right: 4px; font-weight: normal;';
        
        if (data.consumed) details.push(`<div style="display:flex; align-items:baseline; gap:2px;"><span style="${labelStyle}">使用量</span><span style="color:var(--color-danger)">${data.consumed}</span></div>`);
        if (def.showGain && data.gained) {
            details.push(`<div style="display:flex; align-items:baseline; gap:2px;"><span style="${labelStyle}">獲得量</span><span style="color:var(--color-success)">${data.gained}</span></div>`);
        }
        if (def.showRequired && data.required) {
            details.push(`<div style="display:flex; align-items:baseline; gap:2px;"><span style="${labelStyle}">必要量</span><span style="color:var(--color-accent-secondary)">${data.required}</span></div>`);
        }
        
        if (details.length === 0) return '';

        return `
            <div class="export-resource-item" style="border-left: 3px solid ${def.color}; padding-left: 10px; margin-right: 20px;">
                <div style="font-size: 0.75rem; color: ${def.color}; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">${def.name}</div>
                <div style="font-size: 1.1rem; font-weight: 800; display: flex; gap: 15px; align-items: center;">${details.join('')}</div>
            </div>
        `;
    }).join('');

    // ビジュアルウィンドウのスタイルを動的に取得（将来的な色変更への連動対応）
    const visualWindow = document.querySelector('.combo-display');
    const visualStyles = window.getComputedStyle(visualWindow);
    
    // コンボレシピをビジュアル表示形式にする (HTMLエスケープあり)
    const displayString = generateDisplayString(comboTokens, null, true);
    const comboRecipeHtml = `
        <div style="
            background: ${visualStyles.backgroundColor}; 
            color: ${visualStyles.color}; 
            border: ${visualStyles.border}; 
            box-shadow: ${visualStyles.boxShadow};
            padding: 18px 22px; 
            border-radius: 12px; 
            width: 100%; 
            box-sizing: border-box; 
            font-size: 1.4rem; 
            font-weight: 600; 
            line-height: 1.4; 
            word-break: break-all; 
            font-family: ${visualStyles.fontFamily};
            text-align: center;
        ">
            ${displayString}
        </div>
    `;


    template.innerHTML = `
        <div style="padding: 22px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 20px; border: 2px solid rgba(255, 255, 255, 0.1);">
            <div class="export-card-header" style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                <div class="export-card-icon" style="width: 65px; height: 65px; border-radius: 8px; flex-shrink: 0; overflow: hidden; border: 1.5px solid var(--color-accent-secondary); box-shadow: 0 0 10px rgba(0, 212, 255, 0.2);">
                    ${currentProfile.iconUrl ? `<img src="${currentProfile.iconUrl}" alt="Icon" crossorigin="anonymous" style="width:100%; height:100%; object-fit:cover;">` : '<div style="width:100%; height:100%; background:rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; font-size:1.2rem;">👤</div>'}
                </div>
                <div class="export-card-titles" style="flex: 1;">
                    <div class="export-card-game" style="font-size: 0.75rem; opacity: 0.6; text-transform: uppercase; letter-spacing: 1px;">${currentProfile.gameName}</div>
                    <div class="export-card-combo-name" style="font-size: 1.6rem; font-weight: 400; color: #fff; margin: 2px 0; font-family: 'Orbitron', sans-serif;">${comboName}</div>
                    <div class="export-card-character-container" style="margin-top: 2px;">
                        <span style="font-size: 0.6rem; color: var(--color-text-muted); text-transform: uppercase; display: block; line-height: 1; margin-bottom: 1px;">Character:</span>
                        <div class="export-card-character" style="font-size: 1.05rem; font-weight: 400; color: #fff; margin: 0; opacity: 0.9;">${currentProfile.characterName}</div>
                    </div>
                </div>
                <div class="export-card-damage-container" style="background: rgba(255, 51, 102, 0.1); padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(255, 51, 102, 0.2); text-align: right;">
                    <div class="export-card-damage-label" style="font-size: 0.65rem; color: var(--color-accent-primary);">Damage</div>
                    <div class="export-card-damage-value" style="font-size: 1.4rem; font-weight: 800; font-family: 'Orbitron', sans-serif;">${damage}</div>
                </div>
            </div>
            
            <div class="export-card-resources" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 15px; padding: 0 5px;">
                ${resourcesHtml}
            </div>

            <div class="export-card-recipe-container" style="margin-bottom: 20px;">
                ${comboRecipeHtml}
            </div>
            
            <div class="export-card-footer" style="display: flex; justify-content: space-between; align-items: flex-end; font-size: 0.8rem; color: var(--color-text-muted);">
                <div class="export-card-tags">
                    ${tags.map(tag => `<span class="export-card-tag" style="background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 4px; margin-right: 5px;">#${tag.trim()}</span>`).join('')}
                </div>
                <div class="export-card-watermark" style="opacity: 0.4; font-family: 'Orbitron', sans-serif;">Combo Memo Tool</div>
            </div>
        </div>
    `;



    document.body.appendChild(template);

    showNotification('画像を生成中...', 'info');
    
    const images = template.querySelectorAll('img');
    const promises = Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve;
        });
    });

    Promise.all(promises).then(() => {
        html2canvas(template, {
            backgroundColor: "#0f172a",
            useCORS: true,
            allowTaint: false,
            scale: 2,
            logging: false
        }).then(canvas => {
            const image = canvas.toDataURL("image/png");
            const link = document.createElement('a');
            link.download = `combo_${currentProfile.characterName}_${comboName.replace(/\s+/g, '_')}.png`;
            link.href = image;
            link.click();
            template.remove();
            showNotification('画像を保存しました', 'success');
        }).catch(err => {
            console.error('Export failed:', err);
            showNotification('画像の生成に失敗しました', 'error');
            template.remove();
        });
    });
}
