import {
	collection,
	doc,
	getDocs,
	addDoc,
	updateDoc,
	deleteDoc,
	setDoc,
	query,
	orderBy,
	where,
	getDoc
} from 'firebase/firestore'
import { db, auth } from './firebase'

// 허용된 사용자 확인
const ALLOWED_USERS_COLLECTION = 'allowedUsers'

export const isUserAllowed = async (userEmail) => {
	try {
		// 문서 ID가 이메일 주소인 문서가 존재하는지 확인
		const userDocRef = doc(db, ALLOWED_USERS_COLLECTION, userEmail)
		const userDoc = await getDoc(userDocRef)
		const exists = userDoc.exists()
		return exists
	} catch (error) {
		console.error('Error checking allowed users:', error)
		// 권한 오류인 경우 false 반환
		return false
	}
}

export const checkPermission = async () => {
	const user = auth.currentUser
	if (!user) {
		return false
	}
	return await isUserAllowed(user.email)
}

const PROJECTS_COLLECTION = 'projects'
const CATEGORIES_COLLECTION = 'categories'
const FAVORITES_COLLECTION = 'favorites'
const RECENT_COLLECTION = 'recent'

// 프로젝트 관련
export const getProjects = async () => {
	try {
		const projectsSnapshot = await getDocs(collection(db, PROJECTS_COLLECTION))
		const projects = projectsSnapshot.docs.map((doc, index) => ({
			id: doc.id,
			...doc.data(),
			index: index + 1
		}))
		return projects
	} catch (error) {
		console.error('Error in getProjects:', error)
		throw error
	}
}

export const addProject = async (project) => {
	const projectData = {
		...project,
		isFavorite: false,
		isRecent: false,
		lastOpenedAt: null
	}
	const docRef = await addDoc(collection(db, PROJECTS_COLLECTION), projectData)
	return { id: docRef.id, ...projectData }
}

export const updateProject = async (id, project) => {
	const projectRef = doc(db, PROJECTS_COLLECTION, id)
	await updateDoc(projectRef, project)
}

export const deleteProject = async (id) => {
	await deleteDoc(doc(db, PROJECTS_COLLECTION, id))
}

// 카테고리 관련
export const getCategories = async () => {
	try {
		const categoriesSnapshot = await getDocs(collection(db, CATEGORIES_COLLECTION))
		const categories = categoriesSnapshot.docs.map(doc => {
			const data = doc.data()
			return {
				id: doc.id,
				name: data.name || data.category || doc.id,
				color: data.color || '#667eea' // 기본 색상
			}
		}).filter(cat => cat.name)

		// 기본 카테고리가 없으면 기본값 반환 (생성은 로그인된 사용자가 할 수 있음)
		if (categories.length === 0) {
			return [{ name: '기본', color: '#667eea' }] // 생성하지 않고 기본값만 반환
		}

		return categories
	} catch (error) {
		console.error('Error getting categories:', error)
		// Firebase 연결 오류 시에도 기본값 반환
		return [{ name: '기본', color: '#667eea' }]
	}
}

export const addCategory = async (categoryName, color = '#667eea') => {
	await addDoc(collection(db, CATEGORIES_COLLECTION), {
		name: categoryName,
		color: color
	})
}

export const updateCategory = async (oldCategoryName, newCategoryName, newColor = null) => {
	// 기존 카테고리 문서 찾기
	const categoriesSnapshot = await getDocs(
		query(collection(db, CATEGORIES_COLLECTION), where('name', '==', oldCategoryName))
	)

	// 카테고리명 및 색상 업데이트
	const updateData = { name: newCategoryName }
	if (newColor !== null) {
		updateData.color = newColor
	}

	const updatePromises = categoriesSnapshot.docs.map(async (doc) => {
		await updateDoc(doc.ref, updateData)
	})

	await Promise.all(updatePromises)

	// 해당 카테고리를 사용하는 프로젝트들도 업데이트
	const projectsSnapshot = await getDocs(
		query(collection(db, PROJECTS_COLLECTION), where('category', '==', oldCategoryName))
	)

	const projectUpdatePromises = projectsSnapshot.docs.map(async (doc) => {
		await updateDoc(doc.ref, { category: newCategoryName })
	})

	await Promise.all(projectUpdatePromises)
}

export const updateCategoryColor = async (categoryName, color) => {
	const categoriesSnapshot = await getDocs(
		query(collection(db, CATEGORIES_COLLECTION), where('name', '==', categoryName))
	)

	const updatePromises = categoriesSnapshot.docs.map(async (doc) => {
		await updateDoc(doc.ref, { color })
	})

	await Promise.all(updatePromises)
}

export const deleteCategory = async (categoryName) => {
	const categoriesSnapshot = await getDocs(
		query(collection(db, CATEGORIES_COLLECTION), where('name', '==', categoryName))
	)
	categoriesSnapshot.docs.forEach(async (doc) => {
		await deleteDoc(doc.ref)
	})
}

// 즐겨찾기 관련
export const getFavorites = async () => {
	try {
		const favoritesSnapshot = await getDocs(
			query(collection(db, PROJECTS_COLLECTION), where('isFavorite', '==', true))
		)
		const favorites = favoritesSnapshot.docs.map(doc => doc.data().name)
		return favorites
	} catch (error) {
		console.error('Error in getFavorites:', error)
		return [] // 오류 시 빈 배열 반환
	}
}

export const toggleFavorite = async (projectName, isFavorite) => {
	try {
		// 프로젝트 문서 찾기
		const projectsSnapshot = await getDocs(
			query(collection(db, PROJECTS_COLLECTION), where('name', '==', projectName))
		)

		// 프로젝트 문서의 isFavorite 필드 업데이트
		const updatePromises = projectsSnapshot.docs.map(async (doc) => {
			await updateDoc(doc.ref, { isFavorite })
		})

		await Promise.all(updatePromises)
	} catch (error) {
		console.error('Error toggling favorite:', error)
		throw error
	}
}

// 최근 프로젝트 관련
export const getRecent = async () => {
	try {
		// isRecent가 true이고 lastOpenedAt이 있는 프로젝트들을 시간순으로 정렬
		let recentSnapshot
		try {
			recentSnapshot = await getDocs(
				query(
					collection(db, PROJECTS_COLLECTION),
					where('isRecent', '==', true),
					orderBy('lastOpenedAt', 'desc')
				)
			)
		} catch (orderError) {
			// orderBy 실패 시 (인덱스 없거나 필드 없음) 일반 조회
			recentSnapshot = await getDocs(
				query(collection(db, PROJECTS_COLLECTION), where('isRecent', '==', true))
			)
		}
		const recent = recentSnapshot.docs
			.map(doc => doc.data().name)
			.filter(Boolean)
			.slice(0, 8)
		return recent
	} catch (error) {
		console.error('Error in getRecent:', error)
		return []
	}
}

export const addRecent = async (projectName) => {
	try {
		const now = new Date()

		// 프로젝트 문서 찾기
		const projectsSnapshot = await getDocs(
			query(collection(db, PROJECTS_COLLECTION), where('name', '==', projectName))
		)

		// 프로젝트 문서의 isRecent와 lastOpenedAt 업데이트
		const updatePromises = projectsSnapshot.docs.map(async (doc) => {
			await updateDoc(doc.ref, {
				isRecent: true,
				lastOpenedAt: now
			})
		})

		await Promise.all(updatePromises)

		// 8개 초과 항목 처리: 가장 오래된 항목의 isRecent를 false로 변경
		// 인덱스가 없을 수 있으므로 try-catch로 처리
		let allRecentSnapshot
		try {
			allRecentSnapshot = await getDocs(
				query(
					collection(db, PROJECTS_COLLECTION),
					where('isRecent', '==', true),
					orderBy('lastOpenedAt', 'desc')
				)
			)
		} catch (orderError) {
			// orderBy 실패 시 (인덱스 없음) 일반 조회 후 클라이언트에서 정렬
			const allRecentSnapshotUnordered = await getDocs(
				query(collection(db, PROJECTS_COLLECTION), where('isRecent', '==', true))
			)

			// 클라이언트에서 lastOpenedAt 기준으로 정렬
			const sortedDocs = allRecentSnapshotUnordered.docs.sort((a, b) => {
				const aTime = a.data().lastOpenedAt?.toMillis() || 0
				const bTime = b.data().lastOpenedAt?.toMillis() || 0
				return bTime - aTime // 내림차순
			})

			allRecentSnapshot = {
				docs: sortedDocs
			}
		}

		if (allRecentSnapshot.docs.length > 8) {
			const toRemove = allRecentSnapshot.docs.slice(8)
			const removePromises = toRemove.map(async (doc) => {
				await updateDoc(doc.ref, { isRecent: false })
			})
			await Promise.all(removePromises)
		}
	} catch (error) {
		console.error('Error adding recent:', error)
		throw error
	}
}

// 사용자 설정 관련
const USER_SETTINGS_COLLECTION = 'userSettings'

export const getUserSettings = async () => {
	try {
		const user = auth.currentUser
		if (!user) {
			// 로그인하지 않은 경우 기본값 반환
			return { showRecent: true, showFavorites: true }
		}

		const userSettingsRef = doc(db, USER_SETTINGS_COLLECTION, user.email)
		const userSettingsDoc = await getDoc(userSettingsRef)

		if (userSettingsDoc.exists()) {
			const data = userSettingsDoc.data()
			return {
				showRecent: data.showRecent !== undefined ? data.showRecent : true,
				showFavorites: data.showFavorites !== undefined ? data.showFavorites : true
			}
		} else {
			// 문서가 없으면 기본값 반환
			return { showRecent: true, showFavorites: true }
		}
	} catch (error) {
		console.error('Error getting user settings:', error)
		// 오류 시 기본값 반환
		return { showRecent: true, showFavorites: true }
	}
}

export const updateUserSettings = async (settings) => {
	try {
		const user = auth.currentUser
		if (!user) {
			throw new Error('User not logged in')
		}

		const userSettingsRef = doc(db, USER_SETTINGS_COLLECTION, user.email)
		const settingsData = {
			email: user.email,
			...settings
		}

		// setDoc을 사용하여 문서가 없으면 생성, 있으면 업데이트
		await setDoc(userSettingsRef, settingsData, { merge: true })
	} catch (error) {
		console.error('Error updating user settings:', error)
		throw error
	}
}

