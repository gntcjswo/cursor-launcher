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
		const projects = projectsSnapshot.docs.map((doc) => {
			const data = doc.data()
			return {
				id: doc.id,
				...data,
				// number 필드가 없으면 기존 프로젝트를 위한 마이그레이션 (나중에 추가됨)
				number: data.number || 0
			}
		})

		// number 기준으로 정렬 (number가 0이거나 없는 경우는 마지막으로)
		projects.sort((a, b) => {
			const aNum = a.number || 0
			const bNum = b.number || 0
			if (aNum === 0 && bNum === 0) return 0
			if (aNum === 0) return 1
			if (bNum === 0) return -1
			return aNum - bNum
		})

		// number가 0이거나 없는 프로젝트들에 대해 순차적으로 번호 할당 (마이그레이션)
		const numbers = projects.map(p => p.number || 0).filter(n => n > 0)
		let currentNumber = numbers.length > 0 ? Math.max(...numbers) : 0

		const updatePromises = []
		projects.forEach(project => {
			if (!project.number || project.number === 0) {
				currentNumber++
				project.number = currentNumber
				// Firebase에 number 필드 업데이트
				updatePromises.push(
					updateDoc(doc(db, PROJECTS_COLLECTION, project.id), { number: currentNumber })
						.catch(err => console.error('Error updating project number:', err))
				)
			}
		})

		// 모든 업데이트가 완료될 때까지 기다리지 않음 (비동기로 처리)
		if (updatePromises.length > 0) {
			Promise.all(updatePromises).catch(err => console.error('Error in batch update:', err))
		}

		// index는 number와 동일하게 설정
		return projects.map(project => ({
			...project,
			index: project.number
		}))
	} catch (error) {
		console.error('Error in getProjects:', error)
		throw error
	}
}

export const addProject = async (project) => {
	try {
		// 현재 모든 프로젝트를 가져와서 전체 데이터베이스의 최대 번호 찾기
		const projectsSnapshot = await getDocs(collection(db, PROJECTS_COLLECTION))
		const projects = projectsSnapshot.docs.map(doc => ({
			...doc.data(),
			number: doc.data().number || 0
		}))

		// 전체 데이터베이스의 최대 번호 계산
		const numbers = projects.map(p => p.number || 0).filter(n => n > 0)
		const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0

		// 새 프로젝트 번호 = 전체 데이터베이스의 최대 번호 + 1
		const newNumber = maxNumber + 1

		const projectData = {
			...project,
			number: newNumber,
			isFavorite: false,
			isRecent: false,
			lastOpenedAt: null
		}

		const docRef = await addDoc(collection(db, PROJECTS_COLLECTION), projectData)
		return { id: docRef.id, ...projectData, index: newNumber }
	} catch (error) {
		console.error('Error in addProject:', error)
		throw error
	}
}

export const updateProject = async (id, project) => {
	const projectRef = doc(db, PROJECTS_COLLECTION, id)
	await updateDoc(projectRef, project)
}

export const deleteProject = async (id) => {
	try {
		// 삭제할 프로젝트의 번호 확인
		const projectRef = doc(db, PROJECTS_COLLECTION, id)
		const projectDoc = await getDoc(projectRef)
		if (!projectDoc.exists()) {
			throw new Error('Project not found')
		}
		
		const deletedNumber = projectDoc.data().number || 0
		
		// 프로젝트 삭제
		await deleteDoc(projectRef)
		
		// 삭제된 번호보다 큰 번호를 가진 프로젝트들의 번호를 하나씩 감소
		if (deletedNumber > 0) {
			const projectsSnapshot = await getDocs(collection(db, PROJECTS_COLLECTION))
			const updatePromises = []
			
			projectsSnapshot.docs.forEach(doc => {
				const data = doc.data()
				const projectNumber = data.number || 0
				if (projectNumber > deletedNumber) {
					updatePromises.push(
						updateDoc(doc.ref, { number: projectNumber - 1 })
					)
				}
			})
			
			await Promise.all(updatePromises)
		}
	} catch (error) {
		console.error('Error in deleteProject:', error)
		throw error
	}
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
				color: data.color || '#667eea', // 기본 색상
				subcategories: data.subcategories || [], // 서브카테고리 배열
				settings: data.settings || {} // 카테고리 설정
			}
		}).filter(cat => cat.name)

		// 기본 카테고리가 없으면 기본값 반환 (생성은 로그인된 사용자가 할 수 있음)
		if (categories.length === 0) {
			return [{ name: '기본', color: '#667eea', settings: {} }] // 생성하지 않고 기본값만 반환
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

export const updateCategory = async (oldCategoryName, newCategoryName, newColor = null, additionalData = {}) => {
	// 기존 카테고리 문서 찾기
	const categoriesSnapshot = await getDocs(
		query(collection(db, CATEGORIES_COLLECTION), where('name', '==', oldCategoryName))
	)

	// 카테고리명 및 색상 업데이트
	const updateData = { name: newCategoryName, ...additionalData }
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

// 서브카테고리 관련
export const addSubcategory = async (categoryName, subcategoryName) => {
	try {
		const categoriesSnapshot = await getDocs(
			query(collection(db, CATEGORIES_COLLECTION), where('name', '==', categoryName))
		)

		if (categoriesSnapshot.empty) {
			throw new Error('Category not found')
		}

		const updatePromises = categoriesSnapshot.docs.map(async (doc) => {
			const data = doc.data()
			const subcategories = data.subcategories || []

			// 중복 확인
			if (subcategories.includes(subcategoryName)) {
				throw new Error('Subcategory already exists')
			}

			await updateDoc(doc.ref, {
				subcategories: [...subcategories, subcategoryName]
			})
		})

		await Promise.all(updatePromises)
	} catch (error) {
		console.error('Error adding subcategory:', error)
		throw error
	}
}

export const updateSubcategory = async (categoryName, oldSubcategoryName, newSubcategoryName) => {
	try {
		const categoriesSnapshot = await getDocs(
			query(collection(db, CATEGORIES_COLLECTION), where('name', '==', categoryName))
		)

		const updatePromises = categoriesSnapshot.docs.map(async (doc) => {
			const data = doc.data()
			const subcategories = (data.subcategories || []).map(sub =>
				sub === oldSubcategoryName ? newSubcategoryName : sub
			)

			await updateDoc(doc.ref, {
				subcategories: subcategories
			})
		})

		await Promise.all(updatePromises)

		// 해당 서브카테고리를 사용하는 프로젝트들의 subcategory 필드도 업데이트
		const projectsSnapshot = await getDocs(
			query(collection(db, PROJECTS_COLLECTION), where('category', '==', categoryName))
		)

		const projectUpdatePromises = projectsSnapshot.docs.map(async (doc) => {
			const projectData = doc.data()
			if (projectData.subcategory === oldSubcategoryName) {
				await updateDoc(doc.ref, {
					subcategory: newSubcategoryName
				})
			}
		})

		await Promise.all(projectUpdatePromises)
	} catch (error) {
		console.error('Error updating subcategory:', error)
		throw error
	}
}

export const deleteSubcategory = async (categoryName, subcategoryName) => {
	try {
		const categoriesSnapshot = await getDocs(
			query(collection(db, CATEGORIES_COLLECTION), where('name', '==', categoryName))
		)

		const updatePromises = categoriesSnapshot.docs.map(async (doc) => {
			const data = doc.data()
			const subcategories = (data.subcategories || []).filter(sub => sub !== subcategoryName)

			await updateDoc(doc.ref, {
				subcategories: subcategories
			})
		})

		await Promise.all(updatePromises)

		// 해당 서브카테고리를 사용하는 프로젝트들의 subcategory 필드를 제거
		const projectsSnapshot = await getDocs(
			query(collection(db, PROJECTS_COLLECTION), where('category', '==', categoryName))
		)

		const projectUpdatePromises = projectsSnapshot.docs.map(async (doc) => {
			const projectData = doc.data()
			if (projectData.subcategory === subcategoryName) {
				await updateDoc(doc.ref, {
					subcategory: null
				})
			}
		})

		await Promise.all(projectUpdatePromises)
	} catch (error) {
		console.error('Error deleting subcategory:', error)
		throw error
	}
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
			// orderBy 실패 시 (인덱스 없거나 필드 없음) 일반 조회 후 클라이언트에서 정렬
			const unorderedSnapshot = await getDocs(
				query(collection(db, PROJECTS_COLLECTION), where('isRecent', '==', true))
			)

			// 클라이언트에서 lastOpenedAt 기준으로 정렬
			const sortedDocs = unorderedSnapshot.docs.sort((a, b) => {
				const aTime = a.data().lastOpenedAt?.toMillis() || 0
				const bTime = b.data().lastOpenedAt?.toMillis() || 0
				return bTime - aTime // 내림차순 (가장 최근이 먼저)
			})

			recentSnapshot = {
				docs: sortedDocs
			}
		}

		// 프로젝트 이름 추출 및 중복 제거
		const recentNames = recentSnapshot.docs
			.map(doc => doc.data().name)
			.filter(Boolean)

		// 중복 제거 (같은 이름이 여러 번 나타날 수 있으므로)
		const uniqueRecent = []
		const seen = new Set()
		for (const name of recentNames) {
			if (!seen.has(name)) {
				seen.add(name)
				uniqueRecent.push(name)
			}
		}

		return uniqueRecent.slice(0, 8)
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

		if (projectsSnapshot.empty) {
			console.warn(`Project "${projectName}" not found`)
			return
		}

		// 현재 Recent 목록 가져오기 (정렬된 상태로)
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

		// 현재 Recent 목록에서 이미 있는 프로젝트인지 확인
		const currentRecentNames = allRecentSnapshot.docs.map(doc => doc.data().name)
		const isAlreadyRecent = currentRecentNames.includes(projectName)

		// 프로젝트 문서의 isRecent와 lastOpenedAt 업데이트
		// 이미 Recent에 있어도 lastOpenedAt을 업데이트하여 순서를 최상단으로 이동
		const updatePromises = projectsSnapshot.docs.map(async (doc) => {
			await updateDoc(doc.ref, {
				isRecent: true,
				lastOpenedAt: now
			})
		})

		await Promise.all(updatePromises)

		// 업데이트 후 다시 Recent 목록 가져오기 (최신 순으로)
		let updatedRecentSnapshot
		try {
			updatedRecentSnapshot = await getDocs(
				query(
					collection(db, PROJECTS_COLLECTION),
					where('isRecent', '==', true),
					orderBy('lastOpenedAt', 'desc')
				)
			)
		} catch (orderError) {
			// orderBy 실패 시 클라이언트에서 정렬
			const unorderedSnapshot = await getDocs(
				query(collection(db, PROJECTS_COLLECTION), where('isRecent', '==', true))
			)

			const sortedDocs = unorderedSnapshot.docs.sort((a, b) => {
				const aTime = a.data().lastOpenedAt?.toMillis() || 0
				const bTime = b.data().lastOpenedAt?.toMillis() || 0
				return bTime - aTime
			})

			updatedRecentSnapshot = {
				docs: sortedDocs
			}
		}

		// 8개 초과 항목 처리: 가장 오래된 항목의 isRecent를 false로 변경
		if (updatedRecentSnapshot.docs.length > 8) {
			const toRemove = updatedRecentSnapshot.docs.slice(8)
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

export const removeRecent = async (projectName) => {
	try {
		// 프로젝트 문서 찾기
		const projectsSnapshot = await getDocs(
			query(collection(db, PROJECTS_COLLECTION), where('name', '==', projectName))
		)

		if (projectsSnapshot.empty) {
			console.warn(`Project "${projectName}" not found`)
			return
		}

		// 프로젝트 문서의 isRecent를 false로 변경
		const updatePromises = projectsSnapshot.docs.map(async (doc) => {
			await updateDoc(doc.ref, {
				isRecent: false
			})
		})

		await Promise.all(updatePromises)
	} catch (error) {
		console.error('Error removing recent:', error)
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

// 카테고리 설정 업데이트 (기존 updateCategory 함수 활용)
export async function updateCategorySettings(categoryName, settings) {
	try {
		// 기존 카테고리 정보 가져오기
		const categories = await getCategories()
		const existingCategory = categories.find(c => c.name === categoryName)

		if (!existingCategory) {
			throw new Error('Category not found')
		}

		// 기존 updateCategory 함수를 사용하여 설정만 업데이트
		await updateCategory(categoryName, categoryName, existingCategory.color, { 
			settings: settings,
			subcategories: existingCategory.subcategories || []
		})
	} catch (error) {
		console.error('Error updating category settings:', error)
		throw error
	}
}

