export default class LevelManager {
    constructor(experience) {
        this.experience = experience;
        this.currentLevel = 1;
        this.totalLevels = 5;

        // 5 monedas para completar cada nivel
        this.pointsToComplete = {
            1: 5,
            2: 5,
            3: 5,
            4: 5,
            5: 5
        }

        // Spawn point central aproximado para todos los niveles
        this.spawnPoints = {
            1: { x: 1.53, y: 2.57, z: 1.07 },
            2: { x: 1.53, y: 2.57, z: 1.07 },
            3: { x: 1.53, y: 2.57, z: 1.07 },
            4: { x: 1.53, y: 2.57, z: 1.07 },
            5: { x: 1.53, y: 2.57, z: 1.07 }
        }
    }

    nextLevel() {
        if (this.currentLevel < this.totalLevels) {
            this.currentLevel++;
            console.log(`🆙 Avanzando al nivel ${this.currentLevel} de ${this.totalLevels}`)

            this.experience.world.clearCurrentScene();
            this.experience.world.loadLevel(this.currentLevel);

            const spawn = this.getCurrentSpawn()
            setTimeout(() => {
                this.experience.world.resetRobotPosition(spawn)
            }, 1000)
        } else {
            console.warn('⚠️ Ya estamos en el último nivel.')
        }
    }

    resetLevel() {
        this.currentLevel = 1;
        this.experience.world.loadLevel(this.currentLevel);
    }

    getCurrentLevelTargetPoints() {
        return this.pointsToComplete?.[this.currentLevel] || 5;
    }

    getCurrentSpawn() {
        return this.spawnPoints?.[this.currentLevel] || { x: 1.53, y: 2.57, z: 1.07 };
    }

    isLastLevel() {
        return this.currentLevel >= this.totalLevels;
    }
}